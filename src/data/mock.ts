// All mock data lives here. Nothing else in src/ defines fixtures.

import type { RoomId } from '../venue/rooms.ts';
import type { DjSet, NightSchedule, PublicMember, Viewer } from '../venue/machine.ts';

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
];

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
