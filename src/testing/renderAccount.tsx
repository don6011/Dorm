// Test harness for arrival and signup: the account gate over the mock venue,
// on device storage the test can inspect and a clock it controls. `reload`
// is a page reload: a fresh app and mock server on the same device storage.

import { render } from '@testing-library/react';
import { useEffect } from 'react';

import { AccountProvider, useAccount } from '../account/AccountProvider.tsx';
import type { Session } from '../account/service.ts';
import { AccountGate } from '../account/Signup.tsx';
import type { SignupState } from '../account/signup.ts';
import { TEST_NIGHT, TEST_TIMES } from '../data/mock.ts';
import { createMockAccountService, type MockAccountService } from '../data/mockService.ts';
import { MockVenue } from '../data/MockVenue.tsx';
import { memoryStorage } from './memoryStorage.ts';

export function renderAccount({ now = TEST_TIMES.live, storage = memoryStorage() } = {}) {
  /** The app's own account state, as last rendered. */
  const seen: { signup: SignupState | null; session: Session | null } = { signup: null, session: null };
  function Probe() {
    const { signup, session } = useAccount();
    useEffect(() => {
      seen.signup = signup;
      seen.session = session;
    });
    return null;
  }
  const mount = () => {
    const service = createMockAccountService({ clock: () => now, storage });
    const view = render(
      <AccountProvider service={service} storage={storage}>
        <Probe />
        <AccountGate>{(s) => <MockVenue session={s} schedule={TEST_NIGHT} clock={() => now} />}</AccountGate>
      </AccountProvider>,
    );
    return { service, view };
  };
  let current = mount();
  return {
    storage,
    seen,
    get service(): MockAccountService {
      return current.service;
    },
    reload() {
      current.view.unmount();
      current = mount();
    },
  };
}
