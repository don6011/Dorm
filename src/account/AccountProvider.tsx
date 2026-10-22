// Who is signed in. The session token is the only thing kept on the device;
// a reload restores the session through the service, the way the real app
// will. Signup state lives here too, so the flow survives re-renders but
// never a reload (a half-finished signup starts over).

import { createContext, useContext, useEffect, useReducer, useState, type Dispatch, type ReactNode } from 'react';

import { deviceStorage, SESSION_KEY, type AccountService, type DeviceStorage, type Session } from './service.ts';
import { createSignupState, signupReducer, type SignupAction, type SignupState } from './signup.ts';

interface AccountContextValue {
  service: AccountService;
  signup: SignupState;
  dispatch: Dispatch<SignupAction>;
  session: Session | null;
  signedIn: (session: Session) => void;
  signOut: () => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ service, storage, children }: { service: AccountService; storage?: DeviceStorage; children: ReactNode }) {
  const [device] = useState(() => storage ?? deviceStorage());
  const [signup, dispatch] = useReducer(signupReducer, undefined, createSignupState);
  const [session, setSession] = useState<Session | null>(null);
  // Only while a saved token is being checked; a first visit goes straight to arrival.
  const [restoring, setRestoring] = useState(() => device.getItem(SESSION_KEY) !== null);

  useEffect(() => {
    const token = device.getItem(SESSION_KEY);
    if (token === null) return;
    let live = true;
    service.restore(token).then((s) => {
      if (!live) return;
      if (s) setSession(s);
      else device.removeItem(SESSION_KEY);
      setRestoring(false);
    });
    return () => {
      live = false;
    };
  }, [device, service]);

  const signedIn = (s: Session) => {
    device.setItem(SESSION_KEY, s.token);
    setSession(s);
    dispatch({ type: 'restart' });
  };
  const signOut = () => {
    if (session) void service.signOut(session.token);
    device.removeItem(SESSION_KEY);
    setSession(null);
    dispatch({ type: 'restart' });
  };

  return (
    <AccountContext.Provider value={{ service, signup, dispatch, session, signedIn, signOut }}>
      {restoring ? <div className="arrival arrival--restoring" aria-busy="true" /> : children}
    </AccountContext.Provider>
  );
}

// eslint-disable-next-line react/only-export-components -- the hook belongs with its provider
export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used inside <AccountProvider>');
  return ctx;
}
