// Room art drops in by file name: src/assets/rooms/<room.art>.webp (or .png/.jpg).
// A room without a file falls back to its gradient (see .room-tile / .scene).

import { roomChain, SUITE_ID, type Room, type RoomId } from '../venue/rooms.ts';

const ART: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../assets/rooms/*.{webp,png,jpg}', { eager: true, import: 'default' }),
  ).map(([path, url]) => [path.replace(/^.*\/|\.\w+$/g, ''), url]),
);

export function artUrl(room: Room): string | undefined {
  return ART[room.art];
}

/** The Suite and anything inside it: the only places gold is allowed. */
export function inSuite(roomId: RoomId): boolean {
  return roomChain(roomId).some((r) => r.id === SUITE_ID);
}
