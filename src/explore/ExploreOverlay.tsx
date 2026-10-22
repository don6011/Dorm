import { useEffect, useRef, useState } from 'react';

import { canEnter, isOpen, opensAt, showsHeadcount, type VenueState } from '../venue/machine.ts';
import { ROOMS, type Room } from '../venue/rooms.ts';
import { useVenue } from '../venue/VenueProvider.tsx';
import { artUrl, inSuite } from '../rooms/art.ts';
import { DoorSheet } from '../rooms/DoorSheet.tsx';
import { opensDoor } from '../rooms/navigation.ts';
import { roomStatus } from './labels.ts';

const TOP_LEVEL = ROOMS.filter((r) => r.parent === null);
const childrenOf = (id: Room['id']) => ROOMS.filter((r) => r.parent === id);

/** You're in it, or you could join it now. */
const reachable = (state: VenueState, room: Room) => state.location === room.id || canEnter(state, room.id).ok;

export function ExploreOverlay({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useVenue();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Rooms you can join lead; locked rooms follow. A barrier shouldn't be the
  // headline of the list. Sort is stable, so data order holds within each.
  const open = TOP_LEVEL.filter((r) => isOpen(state, r.id)).sort(
    (a, b) => Number(!reachable(state, a)) - Number(!reachable(state, b)),
  );
  const closed = TOP_LEVEL.filter((r) => !isOpen(state, r.id));

  const [door, setDoor] = useState<Room['id'] | null>(null);
  const join = (room: Room) => {
    dispatch({ type: 'enter', roomId: room.id });
    onClose();
  };

  const group = (room: Room) => (
    <li key={room.id}>
      <RoomRow room={room} state={state} onJoin={join} onDoor={(r) => setDoor(r.id)} />
      {childrenOf(room.id).length > 0 && (
        <ul className="explore-children">
          {childrenOf(room.id).map((child) => (
            <li key={child.id}>
              <RoomRow room={child} state={state} onJoin={join} onDoor={(r) => setDoor(r.id)} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );

  return (
    <div className="explore" role="dialog" aria-modal="true" aria-labelledby="explore-title">
      <header className="explore-head">
        <h2 id="explore-title">Explore The Dorm</h2>
        <button ref={closeRef} className="icon-button" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      <div className="explore-body">
        {open.length > 0 ? (
          <ul className="explore-list">{open.map(group)}</ul>
        ) : (
          <p className="explore-empty">Nothing's open right now.</p>
        )}
        {closed.length > 0 && (
          <>
            <div className="explore-divider" role="separator">
              <span>{closed.some((r) => opensAt(state, r.id) !== null) ? 'Not open yet' : 'Closed for tonight'}</span>
            </div>
            <ul className="explore-list explore-list--closed">{closed.map(group)}</ul>
          </>
        )}
      </div>
      {door && <DoorSheet roomId={door} onClose={() => setDoor(null)} onEntered={onClose} />}
    </div>
  );
}

function RoomRow({
  room,
  state,
  onJoin,
  onDoor,
}: {
  room: Room;
  state: VenueState;
  onJoin: (room: Room) => void;
  onDoor: (room: Room) => void;
}) {
  const status = roomStatus(state, room.id);
  const canJoin = status.tone === 'go';
  // A pass room you could get into (request a pass, waitlist) opens its door.
  const door = !canJoin && opensDoor(state, room.id);
  const count = showsHeadcount(state, room.id) ? (state.occupancy[room.id] ?? 0) : null;
  const djHere = state.dj && state.dj.roomId === room.id && isOpen(state, room.id) ? state.dj : null;
  const art = artUrl(room);

  return (
    <button
      className={`room-row${inSuite(room.id) ? ' room-row--suite' : ''}${room.parent ? ' room-row--child' : ''}`}
      onClick={canJoin ? () => onJoin(room) : door ? () => onDoor(room) : undefined}
      aria-disabled={!canJoin && !door}
      aria-label={[room.label, status.pill, status.note].filter(Boolean).join('. ')}
    >
      <span className="room-tile" data-art={room.art} style={art ? { backgroundImage: `url(${art})` } : undefined} />
      <span className="room-text">
        <span className="room-label">{room.label}</span>
        <span className="room-tagline">{room.tagline}</span>
        {status.note && <span className="room-note">{status.note}</span>}
        {(count !== null || djHere) && (
          <span className="room-meta">
            {count !== null && (
              <span>
                {count.toLocaleString()}
                {room.capacity !== null && ` / ${room.capacity}`} here
              </span>
            )}
            {djHere && <span className="room-dj">{djHere.name} · live</span>}
          </span>
        )}
      </span>
      {status.pill && <span className={`pill pill--${status.tone}`}>{status.pill}</span>}
    </button>
  );
}
