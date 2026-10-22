// Connections and safety (mute, block, report). Like canEnter for rooms, the
// rules for who a block or mute hides live here and nowhere else: every
// surface that shows members, messages or invitations filters through these
// selectors.

import { presenceOf, type PublicMember, type VenueState } from '../venue/machine.ts';
import type { RoomId } from '../venue/rooms.ts';

export type ConnectionStatus = 'none' | 'pending' | 'connected';

export interface SocialState {
  connections: Readonly<Record<string, ConnectionStatus>>;
  muted: readonly string[];
  /** Blocked member → their connection before the block, so Undo restores it. */
  blocked: Readonly<Record<string, ConnectionStatus>>;
  reports: readonly { memberId: string; at: number }[];
}

export type SocialAction =
  | { type: 'connect'; memberId: string }
  | { type: 'toggleMute'; memberId: string }
  | { type: 'block'; memberId: string }
  | { type: 'undoBlock'; memberId: string }
  | { type: 'report'; memberId: string; at: number };

export function createSocialState(init: { connections?: Record<string, ConnectionStatus> } = {}): SocialState {
  return { connections: { ...init.connections }, muted: [], blocked: {}, reports: [] };
}

// Nothing here produces an event for the other member. Mutes, blocks and
// reports are never sent to the person they're about.
export function socialReducer(state: SocialState, action: SocialAction): SocialState {
  const id = action.memberId;
  switch (action.type) {
    case 'connect':
      if (isBlocked(state, id) || connectionStatus(state, id) !== 'none') return state;
      return { ...state, connections: { ...state.connections, [id]: 'pending' } };
    case 'toggleMute':
      return {
        ...state,
        muted: state.muted.includes(id) ? state.muted.filter((m) => m !== id) : [...state.muted, id],
      };
    case 'block': {
      if (isBlocked(state, id)) return state;
      const { [id]: prior = 'none', ...connections } = state.connections;
      return { ...state, connections, blocked: { ...state.blocked, [id]: prior } };
    }
    case 'undoBlock': {
      if (!isBlocked(state, id)) return state;
      const { [id]: prior, ...blocked } = state.blocked;
      const connections = prior === 'none' ? state.connections : { ...state.connections, [id]: prior };
      return { ...state, blocked, connections };
    }
    case 'report':
      return { ...state, reports: [...state.reports, { memberId: id, at: action.at }] };
  }
}

export function isBlocked(state: SocialState, memberId: string): boolean {
  return memberId in state.blocked;
}

export function isMuted(state: SocialState, memberId: string): boolean {
  return state.muted.includes(memberId);
}

export function connectionStatus(state: SocialState, memberId: string): ConnectionStatus {
  if (isBlocked(state, memberId)) return 'none';
  return state.connections[memberId] ?? 'none';
}

/** People lists, room rosters and avatars: blocked members disappear. */
export function visibleMembers<T extends { id: string }>(state: SocialState, members: readonly T[]): T[] {
  return members.filter((m) => !isBlocked(state, m.id));
}

/** Any chat: messages from muted or blocked members disappear. */
export function visibleMessages<T extends { authorId: string }>(state: SocialState, messages: readonly T[]): T[] {
  return messages.filter((m) => !isBlocked(state, m.authorId) && !isMuted(state, m.authorId));
}

/** Invitations and passes: anything from a blocked member disappears. */
export function visibleInvites<T extends { fromId: string }>(state: SocialState, invites: readonly T[]): T[] {
  return invites.filter((i) => !isBlocked(state, i.fromId));
}

/** Message threads: blocked members' threads disappear. */
export function visibleThreads<T extends { memberId: string }>(state: SocialState, threads: readonly T[]): T[] {
  return threads.filter((t) => !isBlocked(state, t.memberId));
}

/**
 * Who the viewer sees in a room: there by presenceOf (so 21+ rooms stay
 * masked to outsiders) and not blocked.
 */
export function roomRoster(venue: VenueState, state: SocialState, members: readonly PublicMember[], roomId: RoomId): PublicMember[] {
  return visibleMembers(state, members).filter((m) => {
    const where = presenceOf(venue, m.id);
    return where.kind === 'room' && where.roomId === roomId;
  });
}

/** "N from your campus": people in the room who share the viewer's campus. */
export function campusCount(venue: VenueState, state: SocialState, members: readonly PublicMember[], roomId: RoomId): number {
  const mine = venue.viewer.profile.campus.trim().toLowerCase();
  return roomRoster(venue, state, members, roomId).filter((m) => m.campus.trim().toLowerCase() === mine).length;
}
