import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { MOCK_DJ, MOCK_OCCUPANCY, MOCK_VIEWERS, tonight } from './data/mock.ts'
import { DevRoot } from './dev/DevRoot.tsx'
import { VenueProvider } from './venue/VenueProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {import.meta.env.DEV ? (
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
