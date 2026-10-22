// All mock data lives here. Nothing else in src/ defines fixtures.

import { getRoom, ROOMS, type RoomId } from '../venue/rooms.ts';
import type { DjSet, MenuItem, NextNight, NightSchedule, PublicMember, Viewer } from '../venue/machine.ts';
import type { ConnectionStatus, DirectMessage } from '../social/social.ts';

/**
 * The night's schedule, local time: doors 21:00, After Hours 24:00, close 27:00
 * (3 AM next day), last call 10 minutes before After Hours. The app reads every
 * time it shows from here; change a night by changing these numbers.
 */
export const NIGHT_HOURS = { opens: 21, afterHours: 24, closes: 27 };
export const LAST_CALL_MINUTES = 10;

export function buildNightSchedule(nightOf: Date, hours = NIGHT_HOURS): NightSchedule {
  const at = (hour: number) =>
    new Date(nightOf.getFullYear(), nightOf.getMonth(), nightOf.getDate(), hour).getTime();
  const afterHoursAt = at(hours.afterHours);
  return { opensAt: at(hours.opens), lastCallAt: afterHoursAt - LAST_CALL_MINUTES * 60_000, afterHoursAt, closesAt: at(hours.closes) };
}

/** Tonight's schedule; before closing, "tonight" is the night that started yesterday. */
export function tonight(now: number): NightSchedule {
  const d = new Date(now);
  if (d.getHours() < NIGHT_HOURS.closes - 24) d.setDate(d.getDate() - 1);
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
  { id: 'm-ava', displayName: 'Ava', campus: 'Howard' },
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
  'm-ava': 'suite',
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

/** Returning members who can sign in with an emailed code (mock accounts for the dev viewers). */
export const MOCK_ACCOUNTS = {
  'jordan@howard.edu': 'over21WithSuitePass',
  'sam@utexas.edu': 'over21NoPass',
  'riley@ucla.edu': 'under21WithSuitePass',
} as const satisfies Record<string, keyof typeof MOCK_VIEWERS>;

/** Campus suggested from an email's domain (subdomains match too). Plain names only, no marks. */
export const MOCK_CAMPUS_DOMAINS: Record<string, string> = {
  'howard.edu': 'Howard',
  'utexas.edu': 'Texas',
  'ucla.edu': 'UCLA',
  'umich.edu': 'Michigan',
  'spelman.edu': 'Spelman',
  'famu.edu': 'FAMU',
  'usc.edu': 'USC',
};

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

/**
 * Direct messages with the viewer's connections, oldest first, timed back from
 * `now` so every stamp format shows (today, this week, older). `withId` is the
 * other member; anything not from them is the viewer's, whoever is signed in.
 * Aaliyah's latest is unread; Dev's conversation has been read.
 */
export function mockDms(now: number): DirectMessage[] {
  const ago = (minutes: number) => now - minutes * 60_000;
  const days = (n: number) => n * 24 * 60;
  return [
    { id: 'd1', withId: 'm-dev', authorId: 'm-dev', body: 'good seeing you last week', sentAt: ago(days(9)) },
    { id: 'd2', withId: 'm-dev', authorId: 'v-jordan', body: 'same, come through again', sentAt: ago(days(9) - 25) },
    { id: 'd3', withId: 'm-dev', authorId: 'm-dev', body: 'you coming through tonight?', sentAt: ago(days(2)) },
    { id: 'd4', withId: 'm-dev', authorId: 'v-jordan', body: 'see you upstairs later', sentAt: ago(40) },
    { id: 'd5', withId: 'm-aaliyah', authorId: 'v-jordan', body: 'which room are you starting in', sentAt: ago(12) },
    { id: 'd6', withId: 'm-aaliyah', authorId: 'm-aaliyah', body: 'set times are up https://example.com/tonight', sentAt: ago(6) },
    { id: 'd7', withId: 'm-aaliyah', authorId: 'm-aaliyah', body: 'you on the floor yet?', sentAt: ago(4) },
  ];
}

/** Read marks at sign-in: conversation → last message read. */
export const MOCK_DM_READ: Record<string, string> = { 'm-dev': 'd4' };

/** What the dev panel's "Receive a message" sends, in turn, from the viewer's connections. */
export const MOCK_DM_INCOMING = ['you still out?', 'come find me on the roof', 'this DJ is not missing tonight'] as const;

/** Room chat. The Spot and After Hours start empty. */
export const MOCK_CHAT = [
  { id: 'c1', roomId: 'main-floor', authorId: 'm-aaliyah', body: 'this set is unreal', sentAt: T0 - 90_000 },
  { id: 'c2', roomId: 'main-floor', authorId: 'm-marcus', body: 'who else is here from Texas', sentAt: T0 - 60_000 },
  { id: 'c3', roomId: 'main-floor', authorId: 'm-kofi', body: 'Howard where you at', sentAt: T0 - 45_000 },
  { id: 'c4', roomId: 'main-floor', authorId: 'm-jade', body: 'run it back DJ', sentAt: T0 - 30_000 },
  { id: 'c5', roomId: 'bar', authorId: 'm-zoe', body: 'end of the bar if anyone wants to talk', sentAt: T0 - 120_000 },
  { id: 'c6', roomId: 'rooftop', authorId: 'm-jade', body: 'the view up here though', sentAt: T0 - 200_000 },
  { id: 'c7', roomId: 'suite', authorId: 'm-dev', body: 'quieter up here, I like it', sentAt: T0 - 150_000 },
  { id: 'c8', roomId: 'suite', authorId: 'm-ava', body: 'anyone else from Howard made it up?', sentAt: T0 - 80_000 },
  { id: 'c9', roomId: 'suite-booth', authorId: 'm-imani', body: 'room for two more in the booth', sentAt: T0 - 50_000 },
] as const;

/** Invitations to a room. Not rendered yet; the block rule already covers them. */
export const MOCK_INVITES = [
  { id: 'i1', fromId: 'm-marcus', roomId: 'rooftop', sentAt: T0 - 10 * 60_000 },
] as const;

/**
 * Menus, display only (no ordering or prices in V1). Generic drink names, no
 * brands. Every item says whether it's alcohol-identified; those render only
 * through canSeeAlcohol.
 */
export const MOCK_MENUS: Partial<Record<RoomId, readonly MenuItem[]>> = {
  bar: [
    { id: 'b1', name: 'Neon Spritz', detail: 'Grapefruit, tonic, rosemary', alcohol: false },
    { id: 'b2', name: 'Late Pass', detail: 'Cold brew, oat milk, vanilla', alcohol: false },
    { id: 'b3', name: 'Ginger Fizz', detail: 'Ginger, lime, soda', alcohol: false },
    { id: 'b4', name: 'House Paloma', detail: 'Tequila, grapefruit, lime', alcohol: true },
    { id: 'b5', name: 'Espresso Martini', detail: 'Vodka, espresso, coffee liqueur', alcohol: true },
  ],
  suite: [
    { id: 's1', name: 'Gold Hour', detail: 'Honey, citrus, sparkling water', alcohol: false },
    { id: 's2', name: 'Velvet Cola', detail: 'Cola, vanilla, cherry', alcohol: false },
    { id: 's3', name: 'Suite Negroni', detail: 'Gin, bitter aperitivo, vermouth', alcohol: true },
    { id: 's4', name: 'French 75', detail: 'Gin, lemon, sparkling wine', alcohol: true },
  ],
};

/** The next night's programming, for the end-of-night screen. Doors come from the same schedule. */
export function nextNightAfter(schedule: NightSchedule): NextNight {
  const day = new Date(schedule.opensAt);
  day.setDate(day.getDate() + 1);
  return { opensAt: buildNightSchedule(day).opensAt, dj: { name: 'DJ Nova', genres: ['House', 'R&B', 'Afro house'] } };
}

/**
 * Where the mock crowd is in each part of the night. At After Hours everyone
 * in a room that closes moves downstairs (rooms that stay open keep their
 * people); after closing, everyone has gone home. Used by MockNight only.
 */
export function mockCrowd(phase: 'closed' | 'live' | 'afterHours', nightIsOver: boolean): {
  presence: Record<string, RoomId | null>;
  occupancy: Partial<Record<RoomId, number>>;
} {
  if (nightIsOver) {
    return {
      presence: Object.fromEntries(Object.keys(MOCK_PRESENCE).map((id) => [id, null])),
      occupancy: Object.fromEntries(ROOMS.map((r) => [r.id, 0])),
    };
  }
  if (phase !== 'afterHours') return { presence: { ...MOCK_PRESENCE }, occupancy: { ...MOCK_OCCUPANCY } };

  const closes = (id: RoomId) => !getRoom(id).openDuring.includes('afterHours');
  const downstairs = ROOMS.find((r) => r.lobby && r.openDuring.includes('afterHours'))!.id;
  const presence = Object.fromEntries(
    Object.entries(MOCK_PRESENCE).map(([id, room]) => [id, room && closes(room) ? downstairs : room]),
  );
  const occupancy: Partial<Record<RoomId, number>> = { ...MOCK_OCCUPANCY };
  let moved = 0;
  for (const r of ROOMS) {
    if (closes(r.id)) {
      moved += occupancy[r.id] ?? 0;
      occupancy[r.id] = 0;
    }
  }
  // Most of the floor heads down; some call it a night.
  occupancy[downstairs] = Math.round(moved * 0.6);
  return { presence, occupancy };
}
