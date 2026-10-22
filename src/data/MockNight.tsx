// The mock server's side of the night: when the phase changes, move the mock
// crowd the way the backend will (src/data/mock.ts → mockCrowd). It only uses
// the machine's presence and occupancy actions, and it goes away with the mock
// layer when the backend lands.

import { useEffect, useRef } from 'react';

import { nightOver } from '../venue/machine.ts';
import { useVenue } from '../venue/VenueProvider.tsx';
import { mockCrowd } from './mock.ts';

export function MockNight() {
  const { state, dispatch } = useVenue();
  const { phase } = state;
  const over = nightOver(state);
  // Before After Hours the starting crowd is already what the provider was given,
  // so there's nothing to move until the night changes. Opening the app after
  // midnight (or after close) moves it straight away.
  const applied = useRef<string | null>(phase === 'afterHours' || over ? null : `${phase}|${over}`);

  useEffect(() => {
    const key = `${phase}|${over}`;
    if (applied.current === key) return;
    applied.current = key;
    const { presence, occupancy } = mockCrowd(phase, over);
    dispatch({ type: 'presence', presence });
    dispatch({ type: 'occupancy', counts: occupancy });
  }, [phase, over, dispatch]);

  return null;
}
