// The venue state machine: night phase, where the viewer is, and the one
// access check. Screens read this; they never re-derive phase, location or
// access themselves.

import { getRoom, roomChain, type NightPhase, type RoomId } from './rooms.ts';

/** What any member may see about another member. No DOB, ever (invariant 4). */
export interface PublicMember {
  id: string;
  displayName: string;
  /** Plain text, e.g. "Howard". */
  campus: string;
}

export interface GuestPass {
  roomId: RoomId;
  expiresAt: number;
}

/**
 * The signed-in member's own account. Private fields live beside the public
 * profile, not inside it, so handing `profile` to a screen can't leak them.
 */
export interface Viewer {
  profile: PublicMember;
  /** YYYY-MM-DD. Private. Not editable after registration. */
  dob: string;
  eduVerified: boolean;
  guestPasses: readonly GuestPass[];
}

export interface NightSchedule {
  opensAt: number;
  afterHoursAt: number;
  closesAt: number;
}

export type DenialReason = 'unverified' | 'underage' | 'closed' | 'needsPass' | 'full';

export type Access =
  | { ok: true }
  /** `roomId` is the room in the chain that refused — e.g. The Suite when entering its booth. */
  | { ok: false; reason: DenialReason; roomId: RoomId };

export interface VenueState {
  now: number;
  phase: NightPhase;
  schedule: NightSchedule;
  viewer: Viewer;
  location: RoomId | null;
  /** Headcount per room, including the viewer. */
  occupancy: Partial<Record<RoomId, number>>;
  /** Why the last enter failed, or why the viewer was moved out. */
  lastDenial: Extract<Access, { ok: false }> | null;
}

export type VenueAction =
  | { type: 'tick'; now: number }
  | { type: 'enter'; roomId: RoomId }
  | { type: 'leave' }
  | { type: 'occupancy'; counts: Partial<Record<RoomId, number>> };

export function phaseAt(schedule: NightSchedule, now: number): NightPhase {
  if (now < schedule.opensAt || now >= schedule.closesAt) return 'closed';
  if (now >= schedule.afterHoursAt) return 'afterHours';
  return 'live';
}

/** Whole years of age on the local calendar date of `now`. */
export function ageOn(dob: string, now: number): number {
  const [y, m, d] = dob.split('-').map(Number);
  const today = new Date(now);
  let age = today.getFullYear() - y;
  const month = today.getMonth() + 1;
  if (month < m || (month === m && today.getDate() < d)) age -= 1;
  return age;
}

function hasValidPass(viewer: Viewer, roomId: RoomId, now: number): boolean {
  return viewer.guestPasses.some((p) => p.roomId === roomId && p.expiresAt > now);
}

/**
 * The only access check. `staying` re-validates a room the viewer is already
 * in, so capacity (which already counts them) is skipped.
 */
function checkAccess(state: VenueState, roomId: RoomId, staying: boolean): Access {
  const { viewer, now, phase } = state;
  const chain = roomChain(roomId);
  const age = ageOn(viewer.dob, now);

  // Invariant 5: verified .edu, 18+ platform minimum.
  if (!viewer.eduVerified) return { ok: false, reason: 'unverified', roomId };
  if (age < 18) return { ok: false, reason: 'underage', roomId };

  for (const room of chain) {
    if (!room.openDuring.includes(phase)) return { ok: false, reason: 'closed', roomId: room.id };
  }

  // Invariants 1 and 2: age is settled for the whole chain before any guest
  // pass is consulted, so no pass can influence an age denial.
  for (const room of chain) {
    if (age < room.access.minAge) return { ok: false, reason: 'underage', roomId: room.id };
  }

  for (const room of chain) {
    if (room.access.entry === 'guestPass' && !hasValidPass(viewer, room.id, now)) {
      return { ok: false, reason: 'needsPass', roomId: room.id };
    }
  }

  const target = getRoom(roomId);
  if (!staying && target.capacity !== null && (state.occupancy[roomId] ?? 0) >= target.capacity) {
    return { ok: false, reason: 'full', roomId };
  }

  return { ok: true };
}

export function canEnter(state: VenueState, roomId: RoomId): Access {
  if (state.location === roomId) return { ok: true };
  return checkAccess(state, roomId, false);
}

export function createVenueState(init: {
  viewer: Viewer;
  schedule: NightSchedule;
  now: number;
  occupancy?: Partial<Record<RoomId, number>>;
}): VenueState {
  return {
    now: init.now,
    phase: phaseAt(init.schedule, init.now),
    schedule: init.schedule,
    viewer: init.viewer,
    location: null,
    occupancy: { ...init.occupancy },
    lastDenial: null,
  };
}

function move(
  occupancy: VenueState['occupancy'],
  from: RoomId | null,
  to: RoomId | null,
): VenueState['occupancy'] {
  const next = { ...occupancy };
  if (from) next[from] = Math.max(0, (next[from] ?? 0) - 1);
  if (to) next[to] = (next[to] ?? 0) + 1;
  return next;
}

export function venueReducer(state: VenueState, action: VenueAction): VenueState {
  switch (action.type) {
    case 'tick': {
      const next = { ...state, now: action.now, phase: phaseAt(state.schedule, action.now) };
      if (next.location === null) return next;
      // Phase changes and pass expiry can end the viewer's right to be here.
      const access = checkAccess(next, next.location, true);
      if (access.ok) return next;
      return {
        ...next,
        occupancy: move(next.occupancy, next.location, null),
        location: null,
        lastDenial: access,
      };
    }
    case 'enter': {
      if (state.location === action.roomId) return state;
      const access = checkAccess(state, action.roomId, false);
      if (!access.ok) return { ...state, lastDenial: access };
      return {
        ...state,
        occupancy: move(state.occupancy, state.location, action.roomId),
        location: action.roomId,
        lastDenial: null,
      };
    }
    case 'leave': {
      if (state.location === null) return state;
      return { ...state, occupancy: move(state.occupancy, state.location, null), location: null };
    }
    case 'occupancy':
      return { ...state, occupancy: { ...state.occupancy, ...action.counts } };
  }
}
