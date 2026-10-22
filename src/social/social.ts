// Connections, safety (mute, block, report) and direct messages. Like canEnter
// for rooms, the rules for who a block or mute hides, and who may message whom,
// live here and nowhere else: every surface that shows members, messages or
// invitations filters through these selectors.

import { MAX_MESSAGE_LENGTH } from '../chat/chat.ts';
import { presenceOf, type PublicMember, type VenueState } from '../venue/machine.ts';
import type { RoomId } from '../venue/rooms.ts';

export type ConnectionStatus = 'none' | 'pending' | 'connected';

/** A direct message. A conversation is with one member; any message in it not from them is the viewer's. */
export interface DirectMessage {
  id: string;
  /** The other member in the conversation. */
  withId: string;
  authorId: string;
  body: string;
  sentAt: number;
}

export interface SocialState {
  connections: Readonly<Record<string, ConnectionStatus>>;
  muted: readonly string[];
  /** Blocked member → their connection before the block, so Undo restores it. */
  blocked: Readonly<Record<string, ConnectionStatus>>;
  reports: readonly { memberId: string; at: number }[];
  /** Every direct message, oldest first. Block deletes nothing, so Undo brings a thread back whole. */
  dms: readonly DirectMessage[];
  /** Conversation (the other member's id) → the last message the viewer has read in it. */
  readThrough: Readonly<Record<string, string>>;
}

export type SocialAction =
  | { type: 'connect'; memberId: string }
  | { type: 'toggleMute'; memberId: string }
  | { type: 'block'; memberId: string }
  | { type: 'undoBlock'; memberId: string }
  | { type: 'report'; memberId: string; at: number }
  /** The viewer sends. Refused unless they're connected. */
  | { type: 'sendDm'; message: DirectMessage }
  /** Stands in for the server delivering a message. Dropped unless the sender is a connection. */
  | { type: 'dmReceived'; message: DirectMessage }
  | { type: 'readThread'; memberId: string };

export function createSocialState(
  init: { connections?: Record<string, ConnectionStatus>; dms?: readonly DirectMessage[]; readThrough?: Record<string, string> } = {},
): SocialState {
  return {
    connections: { ...init.connections },
    muted: [],
    blocked: {},
    reports: [],
    dms: [...(init.dms ?? [])],
    readThrough: { ...init.readThrough },
  };
}

// Nothing here produces an event for the other member. Mutes, blocks and
// reports are never sent to the person they're about.
export function socialReducer(state: SocialState, action: SocialAction): SocialState {
  if (action.type === 'sendDm' || action.type === 'dmReceived') {
    const m = action.message;
    // One rule both ways: only connections message each other. A blocked
    // member is no connection, so what they send while blocked is dropped,
    // not stored: Undo brings back the history from before the block only.
    if (!canMessage(state, m.withId)) return state;
    // Received messages are from them; sent ones are the viewer's.
    if ((action.type === 'dmReceived') !== (m.authorId === m.withId)) return state;
    if (state.dms.some((d) => d.id === m.id)) return state;
    const body = m.body.trim();
    if (body === '' || body.length > MAX_MESSAGE_LENGTH) return state;
    return { ...state, dms: [...state.dms, { ...m, body }] };
  }
  const id = action.memberId;
  switch (action.type) {
    case 'readThread': {
      const last = state.dms.findLast((m) => m.withId === id);
      if (!last || state.readThrough[id] === last.id) return state;
      return { ...state, readThrough: { ...state.readThrough, [id]: last.id } };
    }
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

/** Direct messages are between connections only, at any time of night. A blocked member is no connection. */
export function canMessage(state: SocialState, memberId: string): boolean {
  return connectionStatus(state, memberId) === 'connected';
}

/** One conversation, oldest first: empty if they're blocked; their messages hidden if they're muted. */
export function conversation(state: SocialState, memberId: string): DirectMessage[] {
  if (isBlocked(state, memberId)) return [];
  return visibleMessages(state, state.dms.filter((m) => m.withId === memberId));
}

/** Unread: a message from them you can see, after the last one you read. Muted members' messages never count. */
export function hasUnread(state: SocialState, memberId: string): boolean {
  const mark = state.dms.findIndex((m) => m.id === state.readThrough[memberId]);
  return conversation(state, memberId).some((m) => m.authorId === memberId && state.dms.indexOf(m) > mark);
}

export interface Thread {
  memberId: string;
  /** The newest message you can see in it, if any (a muted member's may all be hidden). */
  last: DirectMessage | undefined;
  unread: boolean;
}

/**
 * The Messages list, most recent first. Derived from the messages, so a
 * blocked member's thread disappears and Undo brings it back with its history.
 */
export function visibleThreads(state: SocialState): Thread[] {
  const ids = [...new Set(state.dms.map((m) => m.withId))].filter((id) => !isBlocked(state, id));
  const threads = ids.map((id) => ({ memberId: id, last: conversation(state, id).at(-1), unread: hasUnread(state, id) }));
  const recency = (t: Thread) => (t.last ? state.dms.indexOf(t.last) : -1);
  return threads.sort((a, b) => recency(b) - recency(a));
}

/** The dot on the Messages tab. */
export function anyUnread(state: SocialState): boolean {
  return visibleThreads(state).some((t) => t.unread);
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
