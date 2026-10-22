// The venue state machine: night phase, where the viewer is, and the one
// access check. Screens read this; they never re-derive phase, location or
// access themselves.

import { getRoom, LOBBIES, roomChain, type NightPhase, type RoomId } from './rooms.ts';

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
 * Age tiers, computed from the date of birth by the server. The app never
 * receives the DOB itself (invariant 4), only these flags.
 */
export interface Eligibility {
  is18: boolean;
  is21: boolean;
}

/**
 * The signed-in member's own account. Private fields live beside the public
 * profile, not inside it, so handing `profile` to a screen can't leak them.
 */
export interface Viewer {
  profile: PublicMember;
  eligibility: Eligibility;
  eduVerified: boolean;
  guestPasses: readonly GuestPass[];
}

export interface DjSet {
  name: string;
  genres: readonly string[];
  roomId: RoomId;
}

/** Every time the app shows comes from here: nothing is written into copy or code. */
export interface NightSchedule {
  opensAt: number;
  /** When last call starts in the rooms that close as After Hours opens. */
  lastCallAt: number;
  afterHoursAt: number;
  closesAt: number;
}

/** The next night, for the end-of-night screen. */
export interface NextNight {
  opensAt: number;
  dj: { name: string; genres: readonly string[] } | null;
}

export interface Notice {
  id: string;
  /** A room you asked to be reminded about has opened. */
  roomId: RoomId;
}

/** 'throughParent': the room is reached only from inside its parent (the Suite Booth). */
export type DenialReason = 'unverified' | 'underage' | 'closed' | 'needsPass' | 'throughParent' | 'full';

export type Access =
  | { ok: true }
  /** `roomId` is the room in the chain that refused — e.g. The Suite when entering its booth. */
  | { ok: false; reason: DenialReason; roomId: RoomId };

export interface VenueState {
  now: number;
  phase: NightPhase;
  schedule: NightSchedule;
  viewer: Viewer;
  /** Who's on the decks tonight. Shown only while their room is open. */
  dj: DjSet | null;
  location: RoomId | null;
  /** Headcount per room, including the viewer. */
  occupancy: Partial<Record<RoomId, number>>;
  /** Where other members are: member id → room, or null when not in The Dorm. */
  presence: Readonly<Record<string, RoomId | null>>;
  /** Rooms the viewer asked for a pass to, or joined the waitlist for. Mock until the backend. */
  requests: { passRequested: readonly RoomId[]; waitlisted: readonly RoomId[] };
  /** Food and drink lists per room. Alcohol items render only through canSeeAlcohol. */
  menus: Partial<Record<RoomId, readonly MenuItem[]>>;
  /**
   * The room you were in when it closed for the night, while another room is
   * open to move on to. Home keeps it on screen, read-only, with the prompt to
   * head on. Only ever set by being moved out of a closing room.
   */
  closedOn: RoomId | null;
  /** Rooms you asked to be told about when they open. */
  reminders: readonly RoomId[];
  /** In-app notices waiting to be seen (mock for push). */
  notices: readonly Notice[];
  nextNight: NextNight | null;
  /** Why the last enter failed, or why the viewer was moved out. */
  lastDenial: Extract<Access, { ok: false }> | null;
}

export type VenueAction =
  | { type: 'tick'; now: number }
  | { type: 'enter'; roomId: RoomId }
  | { type: 'leave' }
  | { type: 'occupancy'; counts: Partial<Record<RoomId, number>> }
  | { type: 'presence'; presence: Readonly<Record<string, RoomId | null>> }
  | { type: 'requestPass'; roomId: RoomId }
  | { type: 'joinWaitlist'; roomId: RoomId }
  /** The server granted a pass. Stands in for a backend push; only the dev panel sends it today. */
  | { type: 'passGranted'; pass: GuestPass }
  /** Toggle a reminder for a room that opens later tonight. */
  | { type: 'remind'; roomId: RoomId }
  | { type: 'dismissNotice'; id: string };

export interface MenuItem {
  id: string;
  name: string;
  /** Plain description. No brand names. */
  detail: string;
  /** Alcohol-identified: rendered only when canSeeAlcohol (invariant 3). */
  alcohol: boolean;
}

export function phaseAt(schedule: NightSchedule, now: number): NightPhase {
  if (now < schedule.opensAt || now >= schedule.closesAt) return 'closed';
  if (now >= schedule.afterHoursAt) return 'afterHours';
  return 'live';
}

function meetsAge(eligibility: Eligibility, minAge: 18 | 21): boolean {
  return minAge === 21 ? eligibility.is21 : eligibility.is18;
}

function meetsChainAge(viewer: Viewer, roomId: RoomId): boolean {
  return roomChain(roomId).every((room) => meetsAge(viewer.eligibility, room.access.minAge));
}

/**
 * Invariant 3: whether alcohol-identified items and menus may render for this
 * viewer. Scoped to items and menus, not art. Every menu goes through it, even
 * inside The Suite where everyone is 21+.
 */
export function canSeeAlcohol(state: VenueState): boolean {
  return state.viewer.eligibility.is21;
}

/** A room's menu as this viewer may see it: zero-proof always, alcohol only through canSeeAlcohol. */
export function visibleMenu(state: VenueState, roomId: RoomId): MenuItem[] {
  return (state.menus[roomId] ?? []).filter((item) => !item.alcohol || canSeeAlcohol(state));
}

/** Request a pass: only when the one thing between you and the room is the pass. */
export function canRequestPass(state: VenueState, roomId: RoomId): boolean {
  const access = canEnter(state, roomId);
  return !access.ok && access.reason === 'needsPass' && access.roomId === roomId;
}

/** Join the waitlist: when you'd need a pass, or you hold one and the room is full. Never past an age gate. */
export function canJoinWaitlist(state: VenueState, roomId: RoomId): boolean {
  const access = canEnter(state, roomId);
  return !access.ok && access.roomId === roomId && (access.reason === 'needsPass' || access.reason === 'full');
}

function hasValidPass(viewer: Viewer, roomId: RoomId, now: number): boolean {
  return viewer.guestPasses.some((p) => p.roomId === roomId && p.expiresAt > now);
}

/** The first lobby open right now: Main Floor, then After Hours. */
export function openLobby(state: VenueState): RoomId | null {
  return LOBBIES.find((room) => isOpen(state, room.id))?.id ?? null;
}

/**
 * The room whose scene Home shows: where you are; else the room you were in
 * when it closed (with the prompt to move on); else the open lobby. null =
 * before doors or after the night ends.
 */
export function homeRoom(state: VenueState): RoomId | null {
  return state.location ?? state.closedOn ?? openLobby(state);
}

export function nightOver(state: VenueState): boolean {
  return state.now >= state.schedule.closesAt;
}

/**
 * Last call: you're in a room that closes when After Hours opens, and it's
 * past lastCallAt. Says when, and where the night moves to. People in rooms
 * that stay open (The Suite) or in no room get nothing.
 */
export function lastCall(state: VenueState): { at: number; to: RoomId } | null {
  if (state.location === null || state.phase !== 'live' || state.now < state.schedule.lastCallAt) return null;
  if (roomChain(state.location).every((room) => room.openDuring.includes('afterHours'))) return null;
  const to = LOBBIES.find((room) => room.openDuring.includes('afterHours'));
  return to ? { at: state.schedule.afterHoursAt, to: to.id } : null;
}

/** A reminder makes sense for a room that's closed now and opens later tonight, and that you could enter. */
export function canRemind(state: VenueState, roomId: RoomId): boolean {
  const access = canEnter(state, roomId);
  return !access.ok && access.reason === 'closed' && opensAt(state, roomId) !== null;
}

/** Open in the current phase — the room and every ancestor. */
export function isOpen(state: VenueState, roomId: RoomId): boolean {
  return roomChain(roomId).every((room) => room.openDuring.includes(state.phase));
}

/**
 * When a room that is closed now next opens tonight, or null if it is open
 * or won't open again tonight.
 */
export function opensAt(state: VenueState, roomId: RoomId): number | null {
  if (isOpen(state, roomId)) return null;
  const starts: { phase: NightPhase; at: number }[] = [
    { phase: 'live', at: state.schedule.opensAt },
    { phase: 'afterHours', at: state.schedule.afterHoursAt },
  ];
  const chain = roomChain(roomId);
  const next = starts.find(
    ({ phase, at }) => at > state.now && chain.every((room) => room.openDuring.includes(phase)),
  );
  return next ? next.at : null;
}

/**
 * Whether a room's headcount may be shown. Rule: show occupancy for barriers
 * the viewer can overcome (a pass, verification, a full room), hide it for
 * ones they can't (age). Show the lock, not the party. Closed rooms have no
 * meaningful count.
 */
/** What a viewer may learn about where another member is. */
export type PresenceView =
  | { kind: 'room'; roomId: RoomId }
  /** In a 21+ room the viewer isn't in. Shown as "In The Dorm". */
  | { kind: 'masked' }
  | { kind: 'away' };

/** The outermost 21+ room around `roomId`, or null when no age gate applies. */
function ageGateZone(roomId: RoomId): RoomId | null {
  const gated = roomChain(roomId).filter((room) => room.access.minAge === 21);
  return gated.length > 0 ? gated[gated.length - 1].id : null;
}

/**
 * Where another member appears to be, for every surface that shows presence.
 * Being in a 21+ room reveals that a member is 21+, so it is masked unless the
 * viewer is inside the same age-gated area (e.g. both somewhere in The Suite).
 */
export function presenceOf(state: VenueState, memberId: string): PresenceView {
  const roomId = state.presence[memberId] ?? null;
  if (roomId === null) return { kind: 'away' };
  const zone = ageGateZone(roomId);
  if (zone === null) return { kind: 'room', roomId };
  const viewerInZone = state.location !== null && roomChain(state.location).some((room) => room.id === zone);
  return viewerInZone ? { kind: 'room', roomId } : { kind: 'masked' };
}

export function showsHeadcount(state: VenueState, roomId: RoomId): boolean {
  const access = canEnter(state, roomId);
  if (!access.ok && access.reason === 'underage') return false;
  return isOpen(state, roomId);
}

/**
 * The only access check. `staying` re-validates a room the viewer is already
 * in, so capacity (which already counts them) is skipped.
 */
function checkAccess(state: VenueState, roomId: RoomId, staying: boolean): Access {
  const { viewer, now } = state;
  const chain = roomChain(roomId);

  // Invariant 5: verified .edu, 18+ platform minimum.
  if (!viewer.eduVerified) return { ok: false, reason: 'unverified', roomId };
  if (!viewer.eligibility.is18) return { ok: false, reason: 'underage', roomId };

  // Invariants 1 and 2: age is settled for the whole chain before any guest
  // pass is consulted, so no pass can influence an age denial. It also comes
  // before the phase check: a barrier that can't be overcome is reported over
  // one that is only "not yet".
  for (const room of chain) {
    if (!meetsAge(viewer.eligibility, room.access.minAge)) return { ok: false, reason: 'underage', roomId: room.id };
  }

  if (!isOpen(state, roomId)) {
    const shut = chain.find((room) => !room.openDuring.includes(state.phase))!;
    return { ok: false, reason: 'closed', roomId: shut.id };
  }

  for (const room of chain) {
    if (room.access.entry === 'guestPass' && !hasValidPass(viewer, room.id, now)) {
      return { ok: false, reason: 'needsPass', roomId: room.id };
    }
  }

  // The Suite Booth: only from inside The Suite. Someone already in the room stays.
  const target = getRoom(roomId);
  if (!staying && target.access.reachedFrom === 'parent' && state.location !== target.parent) {
    return { ok: false, reason: 'throughParent', roomId };
  }

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
  dj?: DjSet | null;
  occupancy?: Partial<Record<RoomId, number>>;
  presence?: Readonly<Record<string, RoomId | null>>;
  menus?: Partial<Record<RoomId, readonly MenuItem[]>>;
  nextNight?: NextNight | null;
}): VenueState {
  return {
    now: init.now,
    phase: phaseAt(init.schedule, init.now),
    schedule: init.schedule,
    viewer: init.viewer,
    dj: init.dj ?? null,
    location: null,
    occupancy: { ...init.occupancy },
    presence: { ...init.presence },
    requests: { passRequested: [], waitlisted: [] },
    menus: { ...init.menus },
    closedOn: null,
    reminders: [],
    notices: [],
    nextNight: init.nextNight ?? null,
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
      let next: VenueState = { ...state, now: action.now, phase: phaseAt(state.schedule, action.now) };

      // Reminders for rooms that just opened become notices.
      const opened = next.reminders.filter((roomId) => isOpen(next, roomId));
      if (opened.length > 0) {
        next = {
          ...next,
          reminders: next.reminders.filter((roomId) => !opened.includes(roomId)),
          notices: [...next.notices, ...opened.map((roomId) => ({ id: `${roomId}@${action.now}`, roomId }))],
        };
      }
      // Nowhere left to move on to (end of night): nothing to look back at.
      if (openLobby(next) === null) next = { ...next, closedOn: null };

      if (next.location === null) return next;
      // Phase changes and pass expiry can end the viewer's right to be here.
      const access = checkAccess(next, next.location, true);
      if (access.ok) return next;
      const closedOn = access.reason === 'closed' && openLobby(next) !== null ? next.location : null;
      return {
        ...next,
        occupancy: move(next.occupancy, next.location, null),
        location: null,
        closedOn,
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
        closedOn: null,
        // Being there answers any "it's open" notice about this room.
        notices: state.notices.filter((n) => n.roomId !== action.roomId),
        lastDenial: null,
      };
    }
    case 'leave': {
      if (state.location === null) return { ...state, closedOn: null };
      return { ...state, occupancy: move(state.occupancy, state.location, null), location: null, closedOn: null };
    }
    case 'occupancy':
      return { ...state, occupancy: { ...state.occupancy, ...action.counts } };
    case 'presence':
      return { ...state, presence: { ...state.presence, ...action.presence } };
    case 'requestPass': {
      if (!canRequestPass(state, action.roomId) || state.requests.passRequested.includes(action.roomId)) return state;
      return { ...state, requests: { ...state.requests, passRequested: [...state.requests.passRequested, action.roomId] } };
    }
    case 'joinWaitlist': {
      if (!canJoinWaitlist(state, action.roomId) || state.requests.waitlisted.includes(action.roomId)) return state;
      return { ...state, requests: { ...state.requests, waitlisted: [...state.requests.waitlisted, action.roomId] } };
    }
    case 'remind': {
      if (state.reminders.includes(action.roomId)) {
        return { ...state, reminders: state.reminders.filter((r) => r !== action.roomId) };
      }
      if (!canRemind(state, action.roomId)) return state;
      return { ...state, reminders: [...state.reminders, action.roomId] };
    }
    case 'dismissNotice':
      return { ...state, notices: state.notices.filter((n) => n.id !== action.id) };
    case 'passGranted': {
      // Re-checks age itself: even a granted pass never reaches someone the
      // room's age gate excludes, so no grant path can stand in for 21+.
      if (!meetsChainAge(state.viewer, action.pass.roomId)) return state;
      return {
        ...state,
        viewer: { ...state.viewer, guestPasses: [...state.viewer.guestPasses, action.pass] },
        requests: { ...state.requests, passRequested: state.requests.passRequested.filter((r) => r !== action.pass.roomId) },
      };
    }
  }
}
