import { createContext, useContext, useReducer, useRef, type Dispatch, type ReactNode } from 'react';

import type { PublicMember } from '../venue/machine.ts';
import { useVenue } from '../venue/VenueProvider.tsx';
import {
  createSocialState, socialReducer, type ConnectionStatus, type DirectMessage, type SocialAction, type SocialState,
} from './social.ts';

interface SocialContextValue {
  state: SocialState;
  dispatch: Dispatch<SocialAction>;
  /** Everyone the viewer could come across tonight, before block filtering. */
  members: readonly PublicMember[];
  member: (id: string) => PublicMember | undefined;
  /** Sends a direct message as the viewer. The store refuses it unless you're connected. */
  sendDm: (memberId: string, body: string) => void;
}

const SocialContext = createContext<SocialContextValue | null>(null);

export function SocialProvider(props: {
  members: readonly PublicMember[];
  connections?: Record<string, ConnectionStatus>;
  dms?: readonly DirectMessage[];
  readThrough?: Record<string, string>;
  children: ReactNode;
}) {
  const { state: venue } = useVenue();
  const [state, dispatch] = useReducer(socialReducer, undefined, () =>
    createSocialState({ connections: props.connections, dms: props.dms, readThrough: props.readThrough }),
  );
  const seq = useRef(0);
  const member = (id: string) => props.members.find((m) => m.id === id);
  const sendDm = (memberId: string, body: string) => {
    seq.current += 1;
    dispatch({
      type: 'sendDm',
      message: { id: `me-dm-${seq.current}`, withId: memberId, authorId: venue.viewer.profile.id, body, sentAt: venue.now },
    });
  };
  return (
    <SocialContext.Provider value={{ state, dispatch, members: props.members, member, sendDm }}>
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
