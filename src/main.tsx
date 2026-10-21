import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { MOCK_DJ, MOCK_OCCUPANCY, MOCK_VIEWERS, tonight } from './data/mock.ts'
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
      >
        <App />
      </VenueProvider>
    )}
  </StrictMode>,
)
