import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react';

import { createVenueState, venueReducer, type NightSchedule, type VenueAction, type VenueState, type Viewer } from './machine.ts';
import type { RoomId } from './rooms.ts';

const TICK_MS = 15_000;

interface VenueContextValue {
  state: VenueState;
  dispatch: Dispatch<VenueAction>;
}

const VenueContext = createContext<VenueContextValue | null>(null);

export function VenueProvider(props: {
  viewer: Viewer;
  schedule: NightSchedule;
  occupancy?: Partial<Record<RoomId, number>>;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(venueReducer, undefined, () =>
    createVenueState({ viewer: props.viewer, schedule: props.schedule, occupancy: props.occupancy, now: Date.now() }),
  );

  useEffect(() => {
    const id = setInterval(() => dispatch({ type: 'tick', now: Date.now() }), TICK_MS);
    return () => clearInterval(id);
  }, []);

  return <VenueContext.Provider value={{ state, dispatch }}>{props.children}</VenueContext.Provider>;
}

// eslint-disable-next-line react/only-export-components -- the hook belongs with its provider
export function useVenue(): VenueContextValue {
  const ctx = useContext(VenueContext);
  if (!ctx) throw new Error('useVenue must be used inside <VenueProvider>');
  return ctx;
}
