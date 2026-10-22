// The account server, mocked on the device. It stands in for the backend
// (auth, an age check that runs server-side, an accounts table): what it
// keeps is what a server would keep, in its own storage, which the app's
// state never sees. It goes away when the backend lands.
//
// Unlike the real server it doesn't keep the date of birth at all: the real
// one needs it privately to recompute is21 on a member's birthday; this mock
// keeps the flags from signup.

import type { AccountService, AgeResult, DeviceStorage, NewProfile, Session, VerifyResult } from '../account/service.ts';
import { deviceStorage } from '../account/service.ts';
import { campusError, isEduEmail, nameError, normalizeEmail, normalizeName } from '../account/signup.ts';
import type { Eligibility, Viewer } from '../venue/machine.ts';
import { MOCK_ACCOUNTS, MOCK_CAMPUS_DOMAINS, MOCK_CONNECTIONS, MOCK_DM_READ, MOCK_VIEWERS, mockDms } from './mock.ts';

type ViewerKey = keyof typeof MOCK_VIEWERS;

/** What this "server" keeps, under SERVER_KEY. No dates of birth, no dates at all. */
interface ServerData {
  /** Accounts created by signing up. The mock viewers' accounts come from fixtures. */
  accounts: { email: string; viewer: Viewer }[];
  /** Emails refused for age: a flag on the email, nothing more. */
  refused: string[];
  /** Session token → whose session it is. */
  sessions: Record<string, { email: string } | { viewerKey: ViewerKey }>;
}

const SERVER_KEY = 'dorm.mock.server';

/**
 * Age-gate flags from a date of birth (yyyy-mm-dd) on a given day. A birthday
 * counts from the day itself. Null for a date that isn't real, is in the
 * future, or is more than 120 years back.
 */
export function eligibilityOn(dob: string, today: Date): Eligibility | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const born = new Date(year, month, day);
  if (born.getFullYear() !== year || born.getMonth() !== month || born.getDate() !== day) return null;
  if (born.getTime() > today.getTime()) return null;
  let age = today.getFullYear() - year;
  if (today.getMonth() < month || (today.getMonth() === month && today.getDate() < day)) age -= 1;
  if (age > 120) return null;
  return { is18: age >= 18, is21: age >= 21 };
}

/** The campus for an email's domain, trying cs.ucla.edu, then ucla.edu. Empty when unknown. */
function suggestCampus(email: string): string {
  const labels = email.split('@')[1].split('.');
  for (let i = 0; i < labels.length - 1; i++) {
    const campus = MOCK_CAMPUS_DOMAINS[labels.slice(i).join('.')];
    if (campus) return campus;
  }
  return '';
}

export interface MockAccountService extends AccountService {
  /** Dev panel: the latest code "emailed", read here instead of an inbox. */
  latestCode(): { email: string; code: string } | null;
  subscribe(listener: () => void): () => void;
  /** Dev panel and ?viewer=: a session for a mock viewer, the same kind sign-in makes. */
  signInAs(viewer: ViewerKey): Session;
  /** Dev panel: follow its simulated clock (ages, message times). */
  setClock(clock: () => number): void;
}

export function createMockAccountService({
  clock: initialClock = Date.now,
  storage = deviceStorage(),
  random = Math.random,
}: { clock?: () => number; storage?: DeviceStorage; random?: () => number } = {}): MockAccountService {
  let clock = initialClock;
  const load = (): ServerData => {
    try {
      const raw = storage.getItem(SERVER_KEY);
      if (raw) return JSON.parse(raw) as ServerData;
    } catch {
      /* unreadable: start empty */
    }
    return { accounts: [], refused: [], sessions: {} };
  };
  const data = load();
  const save = () => storage.setItem(SERVER_KEY, JSON.stringify(data));

  // In memory only: codes in flight and signups in progress. A reload mid-signup starts over.
  const codes = new Map<string, string>();
  let latest: { email: string; code: string } | null = null;
  const pending = new Map<string, { email: string; eligibility: Eligibility | null }>();
  const listeners = new Set<() => void>();

  const id = (prefix: string) => `${prefix}-${Math.floor(random() * 2 ** 48).toString(36)}${Math.floor(random() * 2 ** 48).toString(36)}`;
  const reply = <T>(value: T) => Promise.resolve(value);

  const sessionFor = (token: string): Session | null => {
    const who = data.sessions[token];
    if (!who) return null;
    if ('viewerKey' in who) {
      return {
        token,
        viewer: MOCK_VIEWERS[who.viewerKey],
        social: { connections: { ...MOCK_CONNECTIONS }, dms: mockDms(clock()), readThrough: { ...MOCK_DM_READ } },
      };
    }
    const account = data.accounts.find((a) => a.email === who.email);
    return account ? { token, viewer: account.viewer, social: { connections: {}, dms: [], readThrough: {} } } : null;
  };

  const openSession = (who: ServerData['sessions'][string]): Session => {
    const token = id('s');
    data.sessions[token] = who;
    save();
    return sessionFor(token)!;
  };

  return {
    sendCode(raw) {
      if (!isEduEmail(raw)) return reply({ ok: false, error: 'notEdu' } as const);
      const email = normalizeEmail(raw);
      const code = String(Math.floor(random() * 1_000_000)).padStart(6, '0');
      codes.set(email, code); // a new code replaces the old one
      latest = { email, code };
      listeners.forEach((l) => l());
      return reply({ ok: true } as const);
    },

    verifyCode(raw, code): Promise<VerifyResult> {
      const email = normalizeEmail(raw);
      if (!codes.has(email) || codes.get(email) !== code.trim()) return reply({ kind: 'badCode' });
      codes.delete(email);
      if (email in MOCK_ACCOUNTS) return reply({ kind: 'signedIn', session: openSession({ viewerKey: MOCK_ACCOUNTS[email as keyof typeof MOCK_ACCOUNTS] }) });
      if (data.accounts.some((a) => a.email === email)) return reply({ kind: 'signedIn', session: openSession({ email }) });
      if (data.refused.includes(email)) return reply({ kind: 'refused' });
      const token = id('v');
      pending.set(token, { email, eligibility: null });
      return reply({ kind: 'verified', token, suggestedCampus: suggestCampus(email) });
    },

    checkAge(token, dob): Promise<AgeResult> {
      const signup = pending.get(token);
      if (!signup) return reply({ error: 'unverified' });
      if (signup.eligibility) return reply({ error: 'alreadySent' });
      const flags = eligibilityOn(dob, new Date(clock()));
      if (!flags) return reply({ error: 'invalidDate' });
      if (!flags.is18) {
        // Remember the refusal as a flag on the email. Nothing about the date.
        pending.delete(token);
        if (!data.refused.includes(signup.email)) data.refused.push(signup.email);
        save();
      } else {
        signup.eligibility = flags;
      }
      return reply({ is18: flags.is18, is21: flags.is21 });
    },

    createAccount(token, profile: NewProfile, agreed) {
      const signup = pending.get(token);
      if (!signup?.eligibility?.is18 || agreed !== true) return reply({ error: 'unverified' } as const);
      if (nameError(profile.name) || campusError(profile.campus)) return reply({ error: 'invalidProfile' } as const);
      if (profile.photo !== null && !profile.photo.startsWith('data:image/')) return reply({ error: 'invalidProfile' } as const);
      pending.delete(token);
      const viewer: Viewer = {
        profile: {
          id: id('u'),
          displayName: normalizeName(profile.name),
          campus: profile.campus.trim(),
          ...(profile.photo ? { photo: profile.photo } : {}),
        },
        eligibility: signup.eligibility,
        eduVerified: true,
        guestPasses: [],
      };
      data.accounts.push({ email: signup.email, viewer });
      return reply(openSession({ email: signup.email }));
    },

    restore(token) {
      return reply(sessionFor(token));
    },

    signOut(token) {
      delete data.sessions[token];
      save();
      return reply(undefined);
    },

    latestCode: () => latest,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    signInAs: (viewerKey) => openSession({ viewerKey }),
    setClock(next) {
      clock = next;
    },
  };
}
