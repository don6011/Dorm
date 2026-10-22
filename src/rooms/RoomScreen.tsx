// One screen for every room, driven by its record: scene art, then context,
// then interaction, then action. Main Floor's extras (Double Halo, hotspots)
// come from its record's `scene`, not from code that knows it's Main Floor.

import { useEffect, useState } from 'react';

import logo from '../../design/logo-white.webp';
import { ChatDrawer, ChatPeek, type DrawerSize } from '../chat/ChatDrawer.tsx';
import { ExploreOverlay } from '../explore/ExploreOverlay.tsx';
import { lockedReason } from '../explore/labels.ts';
import { PersonTap } from '../people/PersonTap.tsx';
import { campusCount, roomRoster } from '../social/social.ts';
import { useSocial } from '../social/SocialProvider.tsx';
import { canEnter, showsHeadcount } from '../venue/machine.ts';
import { getRoom, LOBBY_ID, type Hotspot, type RoomId } from '../venue/rooms.ts';
import { useVenue } from '../venue/VenueProvider.tsx';
import { artUrl, inSuite } from './art.ts';
import { DoorSheet } from './DoorSheet.tsx';
import { lineup } from './lineup.ts';
import { MenuSheet } from './Menu.tsx';
import { backTarget, opensDoor } from './navigation.ts';

const ROSTER_SHOWN = 5;
const REASON_MS = 3500;

export function RoomScreen({ roomId, chat, onChat }: { roomId: RoomId; chat: DrawerSize; onChat: (size: DrawerSize) => void }) {
  const { state, dispatch } = useVenue();
  const social = useSocial();
  const [exploring, setExploring] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const hasMenu = (state.menus[roomId] ?? []).length > 0;
  const room = getRoom(roomId);
  const inside = state.location === roomId;
  const art = artUrl(room);

  const roster = roomRoster(state, social.state, social.members, roomId);
  const count = showsHeadcount(state, roomId) ? (state.occupancy[roomId] ?? 0) : null;
  const fromCampus = campusCount(state, social.state, social.members, roomId);
  const back = backTarget(state, room);
  const dj = state.dj && state.dj.roomId === roomId ? state.dj : null;

  const [joinReason, setJoinReason] = useState<string | null>(null);
  const join = () => {
    const access = canEnter(state, roomId);
    if (!access.ok) {
      setJoinReason(lockedReason(state, access, roomId));
      return;
    }
    dispatch({ type: 'enter', roomId });
    onChat('half');
  };

  return (
    <section className={`room-screen${inSuite(roomId) ? ' room-screen--suite' : ''}`} aria-labelledby="room-title">
      <div className="scene" data-art={room.art} aria-hidden="true">
        {art && <img src={art} alt="" decoding="async" />}
      </div>
      <div className="scrim-top" aria-hidden="true" />
      <div className="scrim-bottom" aria-hidden="true" />

      <header className="room-top">
        {back ? (
          <button className="back-button" onClick={() => dispatch({ type: 'enter', roomId: back })}>
            ‹ {getRoom(back).label}
          </button>
        ) : inside && room.id !== LOBBY_ID ? (
          <button className="back-button" onClick={() => dispatch({ type: 'leave' })}>
            ‹ Leave
          </button>
        ) : (
          <img className="room-logo" src={logo} alt="The Dorm" />
        )}
      </header>

      {room.scene?.halo && <Halo items={lineup(state)} />}

      {chat === 'peek' &&
        room.scene?.hotspots?.map((h) => (
          <HotspotDoor key={h.roomId} hotspot={h} onEnter={() => dispatch({ type: 'enter', roomId: h.roomId })} />
        ))}

      {chat === 'peek' && (
        <div className={`room-content${inside ? ' room-content--inside' : ''}`}>
          <h1 id="room-title" className="room-title">
            {room.label}
          </h1>
          <p className="room-tagline-lg">{room.tagline}</p>

          {count !== null && (
            <p className="crowd">
              <span className="live-dot" aria-hidden="true" />
              {count.toLocaleString()} {room.crowd}
              {fromCampus > 0 && <span className="crowd-campus"> · {fromCampus} from your campus</span>}
            </p>
          )}

          {roster.length > 0 && (
            <ul className="roster" aria-label={`People ${room.crowd}`}>
              {roster.slice(0, ROSTER_SHOWN).map((m) => (
                <li key={m.id}>
                  <PersonTap member={m} variant="avatar" />
                </li>
              ))}
              {roster.length > ROSTER_SHOWN && <li className="roster-more">+{roster.length - ROSTER_SHOWN}</li>}
            </ul>
          )}

          {dj && (
            <div className="now-playing">
              <span className="np-label">Now playing</span>
              <span className="np-dj">{dj.name}</span>
              <span className="np-genres">{dj.genres.join(' · ')}</span>
            </div>
          )}

          {!inside && (
            <button className="cta room-cta" onClick={join}>
              Join the floor
            </button>
          )}
          {joinReason && (
            <p className="join-reason" role="status">
              {joinReason}
            </p>
          )}
          {hasMenu && (
            <button className="btn menu-button" onClick={() => setMenuOpen(true)}>
              Menu
            </button>
          )}
          <button className="text-button explore-link" onClick={() => setExploring(true)}>
            Explore The Dorm
          </button>
        </div>
      )}

      {inside &&
        (chat === 'peek' ? (
          <ChatPeek room={room} onOpen={() => onChat('half')} />
        ) : (
          <ChatDrawer room={room} size={chat} onSize={onChat} />
        ))}

      {exploring && <ExploreOverlay onClose={() => setExploring(false)} />}
      {menuOpen && <MenuSheet roomId={roomId} onClose={() => setMenuOpen(false)} />}
    </section>
  );
}

/** A door into another room. Its label and lock come from canEnter; a locked tap explains in place. */
function HotspotDoor({ hotspot, onEnter }: { hotspot: Hotspot & { roomId: RoomId }; onEnter: () => void }) {
  const { state } = useVenue();
  const [reason, setReason] = useState<string | null>(null);
  const [door, setDoor] = useState(false);
  const target = getRoom(hotspot.roomId);
  const access = canEnter(state, target.id);
  const ageLocked = !access.ok && access.reason === 'underage';
  const count = showsHeadcount(state, target.id) ? (state.occupancy[target.id] ?? 0) : null;

  useEffect(() => {
    if (!reason) return;
    const id = setTimeout(() => setReason(null), REASON_MS);
    return () => clearTimeout(id);
  }, [reason]);

  const suffix = ageLocked ? '21+' : count !== null ? count.toLocaleString() : null;
  return (
    <div className="hotspot-wrap" style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}>
      <button
        className={`hotspot${inSuite(target.id) ? ' hotspot--suite' : ''}${access.ok ? '' : ' hotspot--locked'}`}
        onClick={() => {
          if (access.ok) onEnter();
          else if (opensDoor(state, target.id)) setDoor(true);
          else setReason(lockedReason(state, access, target.id));
        }}
        aria-label={`${target.label}${suffix ? `, ${ageLocked ? '21 plus' : `${suffix} here`}` : ''}${access.ok ? '' : ', locked'}`}
      >
        {access.ok ? <span className="live-dot" aria-hidden="true" /> : <span aria-hidden="true">🔒︎</span>}
        {target.label}
        {suffix && <span className="hotspot-count"> · {suffix}</span>}
      </button>
      {reason && (
        <p className="hotspot-reason" role="status">
          {reason}
        </p>
      )}
      {door && <DoorSheet roomId={target.id} onClose={() => setDoor(false)} onEntered={() => setDoor(false)} />}
    </div>
  );
}

/** The Double Halo: two chasing rings and a ticker of tonight's lineup. Still under reduced motion. */
function Halo({ items }: { items: string[] }) {
  const text = items.join('   ·   ');
  return (
    <div className="halo">
      <svg viewBox="0 0 390 110" preserveAspectRatio="none" aria-hidden="true">
        <ellipse className="ring-a" cx="195" cy="52" rx="170" ry="34" />
        <ellipse className="ring-b" cx="195" cy="52" rx="150" ry="26" />
      </svg>
      <div className="ticker-band" role="marquee" aria-label={`Tonight: ${items.join('. ')}`}>
        <div className="ticker" aria-hidden="true">
          <span>{text}</span>
          <span>{text}</span>
        </div>
      </div>
    </div>
  );
}
