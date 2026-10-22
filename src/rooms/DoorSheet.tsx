// The door of a pass room (The Suite), for 21+ members who can't walk in yet.
// It shows the head count (a pass can be got, so the count is fair to show) but
// never who is inside. Under-21 members never reach it: age is refused first.

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { lockedReason } from '../explore/labels.ts';
import { canEnter, canJoinWaitlist, canRequestPass, showsHeadcount } from '../venue/machine.ts';
import { getRoom, type RoomId } from '../venue/rooms.ts';
import { useVenue } from '../venue/VenueProvider.tsx';
import { artUrl } from './art.ts';

export function DoorSheet({ roomId, onClose, onEntered }: { roomId: RoomId; onClose: () => void; onEntered?: () => void }) {
  const { state, dispatch } = useVenue();
  const room = getRoom(roomId);
  const access = canEnter(state, roomId);
  const art = artUrl(room);
  const count = showsHeadcount(state, roomId) ? (state.occupancy[roomId] ?? 0) : null;
  const requested = state.requests.passRequested.includes(roomId);
  const waitlisted = state.requests.waitlisted.includes(roomId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const message = access.ok
    ? 'Your pass is ready.'
    : access.reason === 'full'
      ? `${room.label} is full right now.`
      : lockedReason(state, access, roomId);

  // Rendered at <body>, above the bottom nav: the room screen is its own
  // stacking context, so a sheet inside it would sit under the nav.
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet door-sheet" role="dialog" aria-modal="true" aria-labelledby="door-title" onClick={(e) => e.stopPropagation()}>
        <div className="door-art" data-art={room.art} aria-hidden="true">
          {art && <img src={art} alt="" />}
        </div>
        <h2 id="door-title">{room.label}</h2>
        {count !== null && <p className="door-count">{count.toLocaleString()} inside</p>}
        <p className="door-message">{message}</p>

        <div className="door-actions">
          {access.ok ? (
            <button
              className="btn btn--gold"
              onClick={() => {
                dispatch({ type: 'enter', roomId });
                onEntered?.();
              }}
            >
              Walk in
            </button>
          ) : (
            <>
              {(canRequestPass(state, roomId) || requested) && (
                <button className="btn btn--gold" disabled={requested} onClick={() => dispatch({ type: 'requestPass', roomId })}>
                  {requested ? 'Pass requested' : 'Request a pass'}
                </button>
              )}
              {(canJoinWaitlist(state, roomId) || waitlisted) && (
                <button className="btn" disabled={waitlisted} onClick={() => dispatch({ type: 'joinWaitlist', roomId })}>
                  {waitlisted ? 'On the waitlist' : 'Join the waitlist'}
                </button>
              )}
            </>
          )}
        </div>
        {(requested || waitlisted) && !access.ok && <p className="hint">We'll let you know when you can come up.</p>}
      </div>
    </div>,
    document.body,
  );
}
