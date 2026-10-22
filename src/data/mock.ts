// All mock data lives here. Nothing else in src/ defines fixtures.

import type { RoomId } from '../venue/rooms.ts';
import type { DjSet, NightSchedule, PublicMember, Viewer } from '../venue/machine.ts';
import type { ConnectionStatus } from '../social/social.ts';

/** Doors 9 PM, After Hours at midnight, close 3 AM — local time. */
export function buildNightSchedule(nightOf: Date): NightSchedule {
  const at = (hour: number) =>
    new Date(nightOf.getFullYear(), nightOf.getMonth(), nightOf.getDate(), hour).getTime();
  return { opensAt: at(21), afterHoursAt: at(24), closesAt: at(27) };
}

/** Tonight's schedule; before 3 AM, "tonight" is the night that started yesterday. */
export function tonight(now: number): NightSchedule {
  const d = new Date(now);
  if (d.getHours() < 3) d.setDate(d.getDate() - 1);
  return buildNightSchedule(d);
}

/** Fixed reference night for tests: Thu 15 Oct 2026. */
export const TEST_NIGHT = buildNightSchedule(new Date(2026, 9, 15));
export const TEST_TIMES = {
  beforeDoors: new Date(2026, 9, 15, 20).getTime(),
  live: new Date(2026, 9, 15, 22).getTime(),
  afterHours: new Date(2026, 9, 16, 1).getTime(),
  afterClose: new Date(2026, 9, 16, 4).getTime(),
};

const PASS_EXPIRY = new Date(2030, 0, 1).getTime();

export const MOCK_MEMBERS: readonly PublicMember[] = [
  { id: 'm-aaliyah', displayName: 'Aaliyah', campus: 'Howard' },
  { id: 'm-marcus', displayName: 'Marcus', campus: 'Texas' },
  { id: 'm-jade', displayName: 'Jade', campus: 'UCLA' },
  { id: 'm-dev', displayName: 'Dev', campus: 'Michigan' },
  { id: 'm-imani', displayName: 'Imani', campus: 'FAMU' },
  { id: 'm-leo', displayName: 'Leo', campus: 'USC' },
  { id: 'm-kofi', displayName: 'Kofi', campus: 'Howard' },
  { id: 'm-tre', displayName: 'Tre', campus: 'Howard' },
  { id: 'm-sofia', displayName: 'Sofia', campus: 'Texas' },
  { id: 'm-maya', displayName: 'Maya', campus: 'UCLA' },
  { id: 'm-nia', displayName: 'Nia', campus: 'Spelman' },
  { id: 'm-ben', displayName: 'Ben', campus: 'Michigan' },
  { id: 'm-zoe', displayName: 'Zoe', campus: 'Texas' },
];

/** Where each mock member is tonight. m-dev and m-imani are in 21+ rooms. */
export const MOCK_PRESENCE: Readonly<Record<string, RoomId | null>> = {
  'm-aaliyah': 'main-floor',
  'm-marcus': 'bar',
  'm-jade': 'rooftop',
  'm-dev': 'suite',
  'm-imani': 'suite-booth',
  'm-leo': null,
  'm-kofi': 'main-floor',
  'm-tre': 'main-floor',
  'm-sofia': 'main-floor',
  'm-maya': 'main-floor',
  'm-nia': 'main-floor',
  'm-ben': 'main-floor',
  'm-zoe': 'bar',
};

/** Viewers covering each access case. Eligibility stands in for what the server computes from DOB. */
export const MOCK_VIEWERS = {
  over21WithSuitePass: {
    profile: { id: 'v-jordan', displayName: 'Jordan', campus: 'Howard' },
    eligibility: { is18: true, is21: true },
    eduVerified: true,
    guestPasses: [{ roomId: 'suite', expiresAt: PASS_EXPIRY }],
  },
  over21NoPass: {
    profile: { id: 'v-sam', displayName: 'Sam', campus: 'Texas' },
    eligibility: { is18: true, is21: true },
    eduVerified: true,
    guestPasses: [],
  },
  under21WithSuitePass: {
    profile: { id: 'v-riley', displayName: 'Riley', campus: 'UCLA' },
    eligibility: { is18: true, is21: false },
    eduVerified: true,
    guestPasses: [{ roomId: 'suite', expiresAt: PASS_EXPIRY }],
  },
  unverified: {
    profile: { id: 'v-casey', displayName: 'Casey', campus: 'Michigan' },
    eligibility: { is18: true, is21: true },
    eduVerified: false,
    guestPasses: [],
  },
} satisfies Record<string, Viewer>;

export const MOCK_DJ: DjSet = {
  name: 'DJ Elevate',
  genres: ['Hip Hop', 'Afrobeats', 'Amapiano'],
  roomId: 'main-floor',
};

export const MOCK_OCCUPANCY: Partial<Record<RoomId, number>> = {
  'main-floor': 1240,
  bar: 38,
  rooftop: 212,
  suite: 31,
  'suite-booth': 6,
  spot: 147,
  'after-hours': 0,
};

/** The viewer's connections at sign-in. */
export const MOCK_CONNECTIONS: Record<string, ConnectionStatus> = {
  'm-aaliyah': 'connected',
  'm-dev': 'connected',
  'm-jade': 'pending',
};

const T0 = new Date(2026, 9, 15, 22).getTime();

/** Direct-message threads, one per connected member. */
export const MOCK_THREADS = [
  { memberId: 'm-aaliyah', last: { authorId: 'm-aaliyah', body: 'you on the floor yet?', sentAt: T0 - 4 * 60_000 } },
  { memberId: 'm-dev', last: { authorId: 'v-jordan', body: 'see you upstairs later', sentAt: T0 - 22 * 60_000 } },
];

/** Room chat. The Spot, The Suite and After Hours start empty. */
export const MOCK_CHAT = [
  { id: 'c1', roomId: 'main-floor', authorId: 'm-aaliyah', body: 'this set is unreal', sentAt: T0 - 90_000 },
  { id: 'c2', roomId: 'main-floor', authorId: 'm-marcus', body: 'who else is here from Texas', sentAt: T0 - 60_000 },
  { id: 'c3', roomId: 'main-floor', authorId: 'm-kofi', body: 'Howard where you at', sentAt: T0 - 45_000 },
  { id: 'c4', roomId: 'main-floor', authorId: 'm-jade', body: 'run it back DJ', sentAt: T0 - 30_000 },
  { id: 'c5', roomId: 'bar', authorId: 'm-zoe', body: 'end of the bar if anyone wants to talk', sentAt: T0 - 120_000 },
  { id: 'c6', roomId: 'rooftop', authorId: 'm-jade', body: 'the view up here though', sentAt: T0 - 200_000 },
] as const;

/** Invitations to a room. Not rendered yet; the block rule already covers them. */
export const MOCK_INVITES = [
  { id: 'i1', fromId: 'm-marcus', roomId: 'rooftop', sentAt: T0 - 10 * 60_000 },
] as const;
