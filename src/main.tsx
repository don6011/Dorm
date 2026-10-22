import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { MOCK_CHAT, MOCK_CONNECTIONS, MOCK_DJ, MOCK_MEMBERS, MOCK_OCCUPANCY, MOCK_PRESENCE, MOCK_THREADS, MOCK_VIEWERS, tonight } from './data/mock.ts'
import { SocialProvider } from './social/SocialProvider.tsx'
import { ChatProvider } from './chat/ChatProvider.tsx'
import { DevRoot } from './dev/DevRoot.tsx'
import { VenueProvider } from './venue/VenueProvider.tsx'

// Preview deploys set VITE_DEV_TOOLS=true (netlify.toml) to keep the dev switcher.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLS === 'true' ? (
      <DevRoot />
    ) : (
      <VenueProvider
        viewer={MOCK_VIEWERS.over21WithSuitePass}
        schedule={tonight(Date.now())}
        occupancy={MOCK_OCCUPANCY}
        dj={MOCK_DJ}
        presence={MOCK_PRESENCE}
      >
        <SocialProvider members={MOCK_MEMBERS} connections={MOCK_CONNECTIONS} threads={MOCK_THREADS}>
          <ChatProvider initial={MOCK_CHAT}>
            <App />
          </ChatProvider>
        </SocialProvider>
      </VenueProvider>
    )}
  </StrictMode>,
)
