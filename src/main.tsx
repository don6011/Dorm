import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AccountProvider } from './account/AccountProvider.tsx'
import { AccountGate } from './account/Signup.tsx'
import { tonight } from './data/mock.ts'
import { createMockAccountService } from './data/mockService.ts'
import { MockVenue } from './data/MockVenue.tsx'
import { DevRoot } from './dev/DevRoot.tsx'

const tonightSchedule = tonight(Date.now())
const accounts = createMockAccountService()

// Preview deploys set VITE_DEV_TOOLS=true (netlify.toml) to keep the dev switcher.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLS === 'true' ? (
      <DevRoot />
    ) : (
      <AccountProvider service={accounts}>
        <AccountGate>{(session) => <MockVenue session={session} schedule={tonightSchedule} />}</AccountGate>
      </AccountProvider>
    )}
  </StrictMode>,
)
