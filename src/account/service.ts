// The account seam: everything signup and sign-in need from a backend. The
// mock in src/data/mockService.ts implements it on the device today; a
// Supabase version implements the same contract later, with no screen
// changes. Ported from the zip build's DormService (the account slice only).

import type { ConnectionStatus, DirectMessage } from '../social/social.ts';
import type { Eligibility, Viewer } from '../venue/machine.ts';

/** What a member brings into the venue when they sign in. */
export interface Session {
  /** Opaque. It's the only thing the app keeps on the device (SESSION_KEY). */
  token: string;
  viewer: Viewer;
  social: {
    connections: Record<string, ConnectionStatus>;
    dms: readonly DirectMessage[];
    readThrough: Record<string, string>;
  };
}

export type VerifyResult =
  /** The email has an account: they're in. */
  | { kind: 'signedIn'; session: Session }
  /** No account yet: signup carries on. The token is the proof the email was verified. */
  | { kind: 'verified'; token: string; suggestedCampus: string }
  /** This email was refused for age before. All that's kept about it is that flag. */
  | { kind: 'refused' }
  | { kind: 'badCode' };

/** Exactly the two flags on success, never the date. */
export type AgeResult = Eligibility | { error: 'unverified' | 'invalidDate' | 'alreadySent' };

export interface NewProfile {
  name: string;
  campus: string;
  /** A small image as a data URL, or null for the letter monogram. */
  photo: string | null;
}

export interface AccountService {
  /** Emails a 6-digit code. Anything but a .edu address is refused. */
  sendCode(email: string): Promise<{ ok: true } | { ok: false; error: 'notEdu' }>;
  verifyCode(email: string, code: string): Promise<VerifyResult>;
  /**
   * The date of birth (yyyy-mm-dd), sent once. Only is18 and is21 come back.
   * Under 18 ends the signup and is remembered against the email as a flag.
   */
  checkAge(token: string, dob: string): Promise<AgeResult>;
  /** Agreeing is creating. Eligibility comes from checkAge on the server's side, never from the app. */
  createAccount(token: string, profile: NewProfile, agreed: true): Promise<Session | { error: 'unverified' | 'invalidProfile' }>;
  restore(token: string): Promise<Session | null>;
  signOut(token: string): Promise<void>;
}

/** The device storage key for the session token. */
export const SESSION_KEY = 'dorm.session';

export type DeviceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** localStorage, or nothing when it's unavailable (private mode, blocked storage). */
export function deviceStorage(): DeviceStorage {
  const none: DeviceStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  try {
    const s = window.localStorage;
    return {
      getItem: (k) => { try { return s.getItem(k); } catch { return null; } },
      setItem: (k, v) => { try { s.setItem(k, v); } catch { /* full or blocked: the session just won't persist */ } },
      removeItem: (k) => { try { s.removeItem(k); } catch { /* ignore */ } },
    };
  } catch {
    return none;
  }
}
