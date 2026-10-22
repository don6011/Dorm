// Where screens send you. Access itself is always canEnter's call; this only
// decides which screen or sheet answers a tap.

import { canEnter, isOpen, type VenueState } from '../venue/machine.ts';
import { getRoom, LOBBY_ID, type Room, type RoomId } from '../venue/rooms.ts';

/** Back goes to the parent room (The Bar → Main Floor, Booth → The Suite), else the lobby if open. */
export function backTarget(state: VenueState, room: Room): RoomId | null {
  if (room.parent) return room.parent;
  if (room.id !== LOBBY_ID && isOpen(state, LOBBY_ID)) return LOBBY_ID;
  return null;
}

/**
 * Whether a locked tap opens the room's door sheet (pass rooms only: request a
 * pass, join the waitlist) rather than a one-line reason in place. Age comes
 * first in canEnter, so an under-21 member never gets a door.
 */
export function opensDoor(state: VenueState, roomId: RoomId): boolean {
  const access = canEnter(state, roomId);
  return (
    !access.ok &&
    access.roomId === roomId &&
    getRoom(roomId).access.entry === 'guestPass' &&
    (access.reason === 'needsPass' || access.reason === 'full')
  );
}
