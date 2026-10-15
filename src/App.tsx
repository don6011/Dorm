import { useCallback, useState } from 'react';

import logo from '../design/logo-white.webp';
import { describeDenial } from './explore/labels.ts';
import { ExploreOverlay } from './explore/ExploreOverlay.tsx';
import { getRoom } from './venue/rooms.ts';
import { useVenue } from './venue/VenueProvider.tsx';

const PHASE_LABEL = { closed: 'Doors closed', live: 'Live now', afterHours: 'After Hours' } as const;

// Placeholder shell until room screens land.
function App() {
  const { state, dispatch } = useVenue();
  const [exploring, setExploring] = useState(false);
  const closeExplore = useCallback(() => setExploring(false), []);

  return (
    <main className="shell">
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
    </main>
  );
}

export default App;
