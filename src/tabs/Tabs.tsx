import { useCallback, useState } from 'react';

import logo from '../../design/logo-white.webp';
import { describeDenial } from '../explore/labels.ts';
import { ExploreOverlay } from '../explore/ExploreOverlay.tsx';
import { PersonTap, PresenceChip, SelfCard, CampusMonogram } from '../people/PersonTap.tsx';
import { visibleMembers, visibleMessages, visibleThreads } from '../social/social.ts';
import { useSocial } from '../social/SocialProvider.tsx';
import { presenceOf } from '../venue/machine.ts';
import { getRoom } from '../venue/rooms.ts';
import { useVenue } from '../venue/VenueProvider.tsx';

const PHASE_LABEL = { closed: 'Doors closed', live: 'Live now', afterHours: 'After Hours' } as const;

export function HomeTab() {
  const { state, dispatch } = useVenue();
  const [exploring, setExploring] = useState(false);
  const closeExplore = useCallback(() => setExploring(false), []);

  return (
    <section className="shell" aria-label="Home">
      <img className="logo" src={logo} alt="The Dorm" />
      <p className="tagline">Every campus. One night.</p>
      <p className="phase">{PHASE_LABEL[state.phase]}</p>

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
