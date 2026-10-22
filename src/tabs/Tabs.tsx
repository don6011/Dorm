import { useCallback, useState } from 'react';

import logo from '../../design/logo-white.webp';
import type { DrawerSize } from '../chat/ChatDrawer.tsx';
import { inSuite } from '../rooms/art.ts';
import { RoomScreen } from '../rooms/RoomScreen.tsx';
import { SuiteScreen } from '../rooms/SuiteScreen.tsx';
import { describeDenial, formatTime } from '../explore/labels.ts';
import { ExploreOverlay } from '../explore/ExploreOverlay.tsx';
import { PersonTap, PresenceChip, SelfCard, CampusMonogram } from '../people/PersonTap.tsx';
import { visibleMembers, visibleMessages, visibleThreads } from '../social/social.ts';
import { useSocial } from '../social/SocialProvider.tsx';
import { canRemind, homeRoom, nightOver, opensAt, presenceOf } from '../venue/machine.ts';
import { getRoom, LOBBIES } from '../venue/rooms.ts';
import { useVenue } from '../venue/VenueProvider.tsx';

const PHASE_LABEL = { closed: 'Doors closed', live: 'Live now', afterHours: 'After Hours' } as const;

/** Home shows the scene of the room you're in, or Main Floor when it's open; otherwise the doors screen. */
export function HomeTab({ chat, onChat }: { chat: DrawerSize; onChat: (size: DrawerSize) => void }) {
  const { state } = useVenue();
  const room = homeRoom(state);
  if (room !== null && inSuite(room)) return <SuiteScreen key={room} roomId={room} chat={chat} onChat={onChat} />;
  if (room !== null) return <RoomScreen key={room} roomId={room} chat={chat} onChat={onChat} />;
  return nightOver(state) ? <ClosingScreen /> : <DoorsScreen />;
}

function DoorsScreen() {
  const { state, dispatch } = useVenue();
  const [exploring, setExploring] = useState(false);
  const closeExplore = useCallback(() => setExploring(false), []);
  // Before doors: when the first lobby opens, from the schedule, with Remind me.
  const next = LOBBIES.find((r) => opensAt(state, r.id) !== null);
  const doorsAt = next ? opensAt(state, next.id) : null;
  const reminded = next ? state.reminders.includes(next.id) : false;

  return (
    <section className="shell" aria-label="Home">
      <img className="logo" src={logo} alt="The Dorm" />
      <p className="tagline">Every campus. One night.</p>
      <p className="phase">{doorsAt !== null ? `Doors open ${formatTime(doorsAt)}` : PHASE_LABEL[state.phase]}</p>
      {next && (reminded || canRemind(state, next.id)) && (
        <button className="btn upcoming-remind" aria-pressed={reminded} onClick={() => dispatch({ type: 'remind', roomId: next.id })}>
          {reminded ? 'Reminder set' : 'Remind me'}
        </button>
      )}

      {state.location ? (
        <p className="where">
          You're in <strong>{getRoom(state.location).label}</strong>
          <button className="text-button" onClick={() => dispatch({ type: 'leave' })}>
            Leave
          </button>
        </p>
      ) : (
        state.lastDenial && <p className="notice">{describeDenial(state.lastDenial)}</p>
      )}

      <button className="cta" onClick={() => setExploring(true)}>
        Explore The Dorm
      </button>

      {exploring && <ExploreOverlay onClose={closeExplore} />}
    </section>
  );
}

/** The night is over (schedule.closesAt). Everything here comes from the next night's programming. */
function ClosingScreen() {
  const { state } = useVenue();
  const next = state.nextNight;
  return (
    <section className="shell closing" aria-label="Home">
      <img className="logo" src={logo} alt="The Dorm" />
      <h1 className="closing-title">That's the night.</h1>
      <p className="tagline">Every campus. One night.</p>
      {next && (
        <div className="next-night">
          <span className="np-label">Next night</span>
          <span className="next-when">
            {new Date(next.opensAt).toLocaleDateString([], { weekday: 'long' })} · doors {formatTime(next.opensAt)}
          </span>
          {next.dj && (
            <>
              <span className="np-dj">{next.dj.name}</span>
              <span className="np-genres">{next.dj.genres.join(' · ')}</span>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export function PeopleTab() {
  const { state: venue } = useVenue();
  const { state, members } = useSocial();
  // Members in The Dorm first; masked counts as in. Order is stable otherwise.
  const people = visibleMembers(state, members).sort(
    (a, b) => Number(presenceOf(venue, a.id).kind === 'away') - Number(presenceOf(venue, b.id).kind === 'away'),
  );

  return (
    <section className="tab" aria-labelledby="people-title">
      <h1 id="people-title" className="tab-title">People tonight</h1>
      {people.length === 0 ? (
        <p className="empty">No one to show right now.</p>
      ) : (
        <ul className="list">
          {people.map((m) => (
            <li key={m.id}>
              <PersonTap member={m}>
                <span className="campus-line">
                  <CampusMonogram campus={m.campus} />
                  {m.campus}
                </span>
                <PresenceChip memberId={m.id} />
              </PersonTap>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MessagesTab() {
  const { state, member, threads } = useSocial();
  const shown = visibleThreads(state, threads);

  return (
    <section className="tab" aria-labelledby="messages-title">
      <h1 id="messages-title" className="tab-title">Messages</h1>
      {shown.length === 0 ? (
        <p className="empty">No messages yet. Connect with someone to start talking.</p>
      ) : (
        <ul className="list">
          {shown.map((t) => {
            const m = member(t.memberId);
            if (!m) return null;
            const preview = visibleMessages(state, [t.last])[0];
            return (
              <li key={t.memberId}>
                <PersonTap member={m}>
                  <span className="preview">{preview ? preview.body : 'Muted'}</span>
                </PersonTap>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function MeTab() {
  const { state } = useVenue();
  return (
    <section className="tab" aria-labelledby="me-title">
      <h1 id="me-title" className="tab-title">Me</h1>
      <SelfCard member={state.viewer.profile} />

      <div className="card">
        <h2 className="card-title">Date of birth</h2>
        <p>Private. It's never shown to anyone and can't be edited here. If it's wrong, contact support to correct it.</p>
      </div>

      <div className="card">
        <h2 className="card-title">About The Dorm</h2>
        <p>
          The Dorm is an independent venue for verified college students. It isn't affiliated with, endorsed by or
          sponsored by any college or university. School names only show which campus a member attends.
        </p>
      </div>
    </section>
  );
}
