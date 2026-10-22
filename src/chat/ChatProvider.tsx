import { createContext, useContext, useReducer, useRef, type ReactNode } from 'react';

import type { RoomId } from '../venue/rooms.ts';
import { useVenue } from '../venue/VenueProvider.tsx';
import { canPost, chatReducer, roomMessages, type ChatMessage } from './chat.ts';

interface ChatContextValue {
  messages: (roomId: RoomId) => ChatMessage[];
  /** Posts as the viewer. Ignored unless they're in that room. */
  send: (roomId: RoomId, body: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ initial = [], children }: { initial?: readonly ChatMessage[]; children: ReactNode }) {
  const { state: venue } = useVenue();
  const [state, dispatch] = useReducer(chatReducer, { messages: initial });
  const seq = useRef(0);

  const send = (roomId: RoomId, body: string) => {
    if (!canPost(venue, roomId)) return;
    seq.current += 1;
    dispatch({
      type: 'send',
      message: { id: `me-${seq.current}`, roomId, authorId: venue.viewer.profile.id, body, sentAt: venue.now },
    });
  };

  return (
    <ChatContext.Provider value={{ messages: (roomId) => roomMessages(state, roomId), send }}>{children}</ChatContext.Provider>
  );
}

// eslint-disable-next-line react/only-export-components -- the hook belongs with its provider
export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside <ChatProvider>');
  return ctx;
}
