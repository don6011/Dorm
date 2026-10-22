// The venue for a signed-in session, on mock data: the tree main.tsx and the
// dev root render once someone is in. Goes away with the mock layer.

import type { ReactNode } from 'react';

import { useAccount } from '../account/AccountProvider.tsx';
import type { Session } from '../account/service.ts';
import App from '../App.tsx';
import { ChatProvider } from '../chat/ChatProvider.tsx';
import { SocialProvider } from '../social/SocialProvider.tsx';
import type { NightSchedule } from '../venue/machine.ts';
import { VenueProvider } from '../venue/VenueProvider.tsx';
import { MOCK_CHAT, MOCK_DJ, MOCK_MEMBERS, MOCK_MENUS, MOCK_OCCUPANCY, MOCK_PRESENCE, nextNightAfter } from './mock.ts';
import { MockNight } from './MockNight.tsx';

export function MockVenue({
  session,
  schedule,
  clock,
  children,
}: {
  session: Session;
  schedule: NightSchedule;
  clock?: () => number;
  /** Rendered inside the providers (the dev panel's venue tools). */
  children?: ReactNode;
}) {
  const { signOut } = useAccount();
  return (
    <VenueProvider
      key={session.token}
      viewer={session.viewer}
      schedule={schedule}
      occupancy={MOCK_OCCUPANCY}
      dj={MOCK_DJ}
      presence={MOCK_PRESENCE}
      menus={MOCK_MENUS}
      nextNight={nextNightAfter(schedule)}
      clock={clock}
    >
      <MockNight />
      <SocialProvider
        members={MOCK_MEMBERS}
        connections={session.social.connections}
        dms={session.social.dms}
        readThrough={session.social.readThrough}
      >
        <ChatProvider initial={MOCK_CHAT}>
          <App onSignOut={signOut} />
        </ChatProvider>
        {children}
      </SocialProvider>
    </VenueProvider>
  );
}
