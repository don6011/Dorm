// The Suite and the Suite Booth: the only gold rooms. Quieter than the floor:
// a framed scene instead of full-bleed, no halo or ticker, a small roster.
// Everyone here passed canEnter (21+ and a pass); menus still go through
// canSeeAlcohol, and the booth is only reachable from in here.

import { useState } from 'react';

import { ChatDrawer, ChatPeek, type DrawerSize } from '../chat/ChatDrawer.tsx';
import { lockedReason } from '../explore/labels.ts';
import { PersonTap } from '../people/PersonTap.tsx';
import { campusCount, roomRoster } from '../social/social.ts';
import { useSocial } from '../social/SocialProvider.tsx';
import { canEnter, showsHeadcount } from '../venue/machine.ts';
import { getRoom, ROOMS, type Room, type RoomId } from '../venue/rooms.ts';
import { useVenue } from '../venue/VenueProvider.tsx';
import { artUrl } from './art.ts';
import { MenuSheet } from './Menu.tsx';
import { backTarget } from './navigation.ts';

const ROSTER_SHOWN = 4;

export function SuiteScreen({ roomId, chat, onChat }: { roomId: RoomId; chat: DrawerSize; onChat: (size: DrawerSize) => void }) {
  const { state, dispatch } = useVenue();
  const social = useSocial();
  const [menuOpen, setMenuOpen] = useState(false);
  const room = getRoom(roomId);
  const art = artUrl(room) ?? (room.parent ? artUrl(getRoom(room.parent)) : undefined);
  const roster = roomRoster(state, social.state, social.members, roomId);
  const count = showsHeadcount(state, roomId) ? (state.occupancy[roomId] ?? 0) : null;
  const fromCampus = campusCount(state, social.state, social.members, roomId);
  const back = backTarget(state, room);
  const inner = ROOMS.filter((r) => r.parent === roomId);
  const hasMenu = (state.menus[roomId] ?? []).length > 0;

  return (
    <section className="room-screen suite-screen" aria-labelledby="room-title">
      <div className="suite-scene" data-art={room.art} aria-hidden="true">
        {art && <img src={art} alt="" decoding="async" />}
      </div>

      <header className="room-top">
        {back ? (
          <button className="back-button back-button--gold" onClick={() => dispatch({ type: 'enter', roomId: back })}>
            ‹ {getRoom(back).label}
          </button>
        ) : (
          <button className="back-button back-button--gold" onClick={() => dispatch({ type: 'leave' })}>
            ‹ Leave
          </button>
        )}
      </header>

      {chat === 'peek' && (
        <div className="suite-body">
          <p className="suite-eyebrow">{room.parent ? `Inside ${getRoom(room.parent).label}` : 'VIP'}</p>
          <h1 id="room-title" className="suite-title">
            {room.label}
          </h1>
          <p className="suite-tagline">{room.tagline}</p>

          {count !== null && (
            <p className="crowd crowd--gold">
              <span className="live-dot live-dot--gold" aria-hidden="true" />
              {count.toLocaleString()} {room.crowd}
              {fromCampus > 0 && <span className="crowd-campus"> · {fromCampus} from your campus</span>}
            </p>
          )}

          {roster.length > 0 && (
            <ul className="roster roster--gold" aria-label={`People ${room.crowd}`}>
              {roster.slice(0, ROSTER_SHOWN).map((m) => (
                <li key={m.id}>
                  <PersonTap member={m} variant="avatar" />
                </li>
              ))}
              {roster.length > ROSTER_SHOWN && <li className="roster-more">+{roster.length - ROSTER_SHOWN}</li>}
            </ul>
          )}

          {inner.map((r) => (
            <InnerRoomCard key={r.id} room={r} />
          ))}

          {hasMenu && (
            <button className="btn btn--gold-outline suite-menu-button" onClick={() => setMenuOpen(true)}>
              Menu
            </button>
          )}
        </div>
      )}

      {state.location === roomId &&
        (chat === 'peek' ? (
          <ChatPeek room={room} onOpen={() => onChat('half')} />
        ) : (
          <ChatDrawer room={room} size={chat} onSize={onChat} />
        ))}

      {menuOpen && <MenuSheet roomId={roomId} onClose={() => setMenuOpen(false)} />}
    </section>
  );
}

/** A room inside this one (the Suite Booth). Its door works only from in here. */
function InnerRoomCard({ room }: { room: Room }) {
  const { state, dispatch } = useVenue();
  const [reason, setReason] = useState<string | null>(null);
  const access = canEnter(state, room.id);
  const count = showsHeadcount(state, room.id) ? (state.occupancy[room.id] ?? 0) : null;

  return (
    <div className="inner-room">
      <div className="inner-room-text">
        <span className="inner-room-name">{room.label}</span>
        <span className="inner-room-meta">
          {room.tagline}
          {count !== null && ` · ${count}${room.capacity !== null ? ` / ${room.capacity}` : ''}`}
        </span>
        {reason && (
          <span className="inner-room-reason" role="status">
            {reason}
          </span>
        )}
      </div>
      <button
        className="btn btn--gold inner-room-join"
        aria-label={`Join ${room.label}`}
        onClick={() => (access.ok ? dispatch({ type: 'enter', roomId: room.id }) : setReason(lockedReason(state, access, room.id)))}
      >
        {access.ok ? 'Join' : access.reason === 'full' ? 'Full' : 'Locked'}
      </button>
    </div>
  );
}
