import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';

import type { PublicMember } from '../venue/machine.ts';
import { createSocialState, socialReducer, type ConnectionStatus, type SocialAction, type SocialState } from './social.ts';

export interface Thread {
  memberId: string;
  last: { authorId: string; body: string; sentAt: number };
}

interface SocialContextValue {
  state: SocialState;
  dispatch: Dispatch<SocialAction>;
  /** Everyone the viewer could come across tonight, before block filtering. */
  members: readonly PublicMember[];
  member: (id: string) => PublicMember | undefined;
  threads: readonly Thread[];
}

const SocialContext = createContext<SocialContextValue | null>(null);

export function SocialProvider(props: {
  members: readonly PublicMember[];
  connections?: Record<string, ConnectionStatus>;
  threads?: readonly Thread[];
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(socialReducer, undefined, () =>
    createSocialState({ connections: props.connections }),
  );
  const member = (id: string) => props.members.find((m) => m.id === id);
  return (
    <SocialContext.Provider value={{ state, dispatch, members: props.members, member, threads: props.threads ?? [] }}>
      {props.children}
    </SocialContext.Provider>
  );
}

// eslint-disable-next-line react/only-export-components -- the hook belongs with its provider
export function useSocial(): SocialContextValue {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error('useSocial must be used inside <SocialProvider>');
  return ctx;
}
