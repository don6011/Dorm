// Test harness: the whole app wired like main.tsx, on mock data and a clock the
// test controls. Time moves only through the machine's own `tick` action.

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect, type Dispatch } from 'react';

import App from '../App.tsx';
import { ChatProvider } from '../chat/ChatProvider.tsx';
import {
  MOCK_CHAT, MOCK_CONNECTIONS, MOCK_DJ, MOCK_MEMBERS, MOCK_MENUS, MOCK_OCCUPANCY, MOCK_PRESENCE, MOCK_DM_READ,
  MOCK_VIEWERS, mockDms, nextNightAfter, TEST_NIGHT, TEST_TIMES,
} from '../data/mock.ts';
import { MockNight } from '../data/MockNight.tsx';
import { SocialProvider } from '../social/SocialProvider.tsx';
import type { NightSchedule, VenueAction, Viewer } from '../venue/machine.ts';
import type { RoomId } from '../venue/rooms.ts';
import { useVenue, VenueProvider } from '../venue/VenueProvider.tsx';

export function renderApp({
  viewer = MOCK_VIEWERS.over21WithSuitePass,
  now = TEST_TIMES.live,
  occupancy = {},
  schedule = TEST_NIGHT,
}: { viewer?: Viewer; now?: number; occupancy?: Partial<Record<RoomId, number>>; schedule?: NightSchedule } = {}) {
  const machine: { dispatch: Dispatch<VenueAction> } = { dispatch: () => {} };
  function Grab() {
    const { dispatch } = useVenue();
    useEffect(() => {
      machine.dispatch = dispatch;
    }, [dispatch]);
    return null;
  }
  render(
    <VenueProvider
      viewer={viewer}
      schedule={schedule}
      occupancy={{ ...MOCK_OCCUPANCY, ...occupancy }}
      dj={MOCK_DJ}
      presence={MOCK_PRESENCE}
      menus={MOCK_MENUS}
      nextNight={nextNightAfter(schedule)}
      clock={() => now}
    >
      <Grab />
      <MockNight />
      <SocialProvider members={MOCK_MEMBERS} connections={MOCK_CONNECTIONS} dms={mockDms(now)} readThrough={MOCK_DM_READ}>
        <ChatProvider initial={MOCK_CHAT}>
          <App />
        </ChatProvider>
      </SocialProvider>
    </VenueProvider>,
  );
  return {
    /** Move the night's clock, the way the provider's ticks do. */
    tick: (at: number) => act(() => machine.dispatch({ type: 'tick', now: at })),
  };
}

export const nav = () => screen.queryByRole('navigation', { name: 'Main' });
export const goTo = (tab: 'Home' | 'People' | 'Messages' | 'Me') =>
  fireEvent.click(within(nav()!).getByRole('button', { name: tab }));
/** Every PersonTap for a member on screen (avatar, name, row). */
export const people = (name: string) => screen.queryAllByRole('button', { name: `${name}, open profile` });
export const person = (name: string) => people(name)[0] ?? null;
export const sheet = () => screen.queryByRole('dialog');
