// Test harness: the whole app wired like main.tsx, on mock data and a fixed clock.

import { fireEvent, render, screen, within } from '@testing-library/react';

import App from '../App.tsx';
import { ChatProvider } from '../chat/ChatProvider.tsx';
import {
  MOCK_CHAT, MOCK_CONNECTIONS, MOCK_DJ, MOCK_MEMBERS, MOCK_OCCUPANCY, MOCK_PRESENCE, MOCK_THREADS, MOCK_VIEWERS,
  TEST_NIGHT, TEST_TIMES,
} from '../data/mock.ts';
import { SocialProvider } from '../social/SocialProvider.tsx';
import type { Viewer } from '../venue/machine.ts';
import { VenueProvider } from '../venue/VenueProvider.tsx';

export function renderApp({ viewer = MOCK_VIEWERS.over21WithSuitePass, now = TEST_TIMES.live }: { viewer?: Viewer; now?: number } = {}) {
  render(
    <VenueProvider
      viewer={viewer}
      schedule={TEST_NIGHT}
      occupancy={MOCK_OCCUPANCY}
      dj={MOCK_DJ}
      presence={MOCK_PRESENCE}
      clock={() => now}
    >
      <SocialProvider members={MOCK_MEMBERS} connections={MOCK_CONNECTIONS} threads={MOCK_THREADS}>
        <ChatProvider initial={MOCK_CHAT}>
          <App />
        </ChatProvider>
      </SocialProvider>
    </VenueProvider>,
  );
}

export const nav = () => screen.queryByRole('navigation', { name: 'Main' });
export const goTo = (tab: 'Home' | 'People' | 'Messages' | 'Me') =>
  fireEvent.click(within(nav()!).getByRole('button', { name: tab }));
/** Every PersonTap for a member on screen (avatar, name, row). */
export const people = (name: string) => screen.queryAllByRole('button', { name: `${name}, open profile` });
export const person = (name: string) => people(name)[0] ?? null;
export const sheet = () => screen.queryByRole('dialog');
