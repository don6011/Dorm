import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { MOCK_CHAT, MOCK_CONNECTIONS, MOCK_DJ, MOCK_MEMBERS, MOCK_MENUS, MOCK_OCCUPANCY, MOCK_PRESENCE, MOCK_DMS, MOCK_DM_READ, MOCK_VIEWERS, nextNightAfter, tonight } from './data/mock.ts'
import { SocialProvider } from './social/SocialProvider.tsx'
import { ChatProvider } from './chat/ChatProvider.tsx'
import { DevRoot } from './dev/DevRoot.tsx'
import { MockNight } from './data/MockNight.tsx'
import { VenueProvider } from './venue/VenueProvider.tsx'

const tonightSchedule = tonight(Date.now())

// Preview deploys set VITE_DEV_TOOLS=true (netlify.toml) to keep the dev switcher.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLS === 'true' ? (
      <DevRoot />
    ) : (
      <VenueProvider
        viewer={MOCK_VIEWERS.over21WithSuitePass}
        schedule={tonightSchedule}
        occupancy={MOCK_OCCUPANCY}
        dj={MOCK_DJ}
        presence={MOCK_PRESENCE}
        menus={MOCK_MENUS}
        nextNight={nextNightAfter(tonightSchedule)}
      >
        <MockNight />
        <SocialProvider members={MOCK_MEMBERS} connections={MOCK_CONNECTIONS} dms={MOCK_DMS} readThrough={MOCK_DM_READ}>
          <ChatProvider initial={MOCK_CHAT}>
            <App />
          </ChatProvider>
        </SocialProvider>
      </VenueProvider>
    )}
  </StrictMode>,
)
