// Where screens send you. Access itself is always canEnter's call; this only
// decides which screen or sheet answers a tap.

import { canEnter, openLobby, type VenueState } from '../venue/machine.ts';
import { getRoom, type Room, type RoomId } from '../venue/rooms.ts';

/**
 * Back goes to the parent room (The Bar → Main Floor, Booth → The Suite), else
 * the open lobby (Main Floor, or After Hours once it's open), else nowhere.
 */
export function backTarget(state: VenueState, room: Room): RoomId | null {
  if (room.parent) return room.parent;
  const lobby = openLobby(state);
  return lobby !== null && lobby !== room.id ? lobby : null;
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
