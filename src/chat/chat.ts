// Room chat. Who may post where is decided here; who is hidden (mute, block)
// is decided in social.ts and applied when messages render.

import { isOpen, type VenueState } from '../venue/machine.ts';
import type { RoomId } from '../venue/rooms.ts';

export const MAX_MESSAGE_LENGTH = 500;

export interface ChatMessage {
  id: string;
  roomId: RoomId;
  authorId: string;
  body: string;
  sentAt: number;
}

export interface ChatState {
  messages: readonly ChatMessage[];
}

export type ChatAction = { type: 'send'; message: ChatMessage };

/** You can post only in the room you're in, and only while it's open. Closed rooms are read-only. */
export function canPost(venue: VenueState, roomId: RoomId): boolean {
  return venue.location === roomId && isOpen(venue, roomId);
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'send': {
      const body = action.message.body.trim();
      if (body === '' || body.length > MAX_MESSAGE_LENGTH) return state;
      return { messages: [...state.messages, { ...action.message, body }] };
    }
  }
}

export function roomMessages(state: ChatState, roomId: RoomId): ChatMessage[] {
  return state.messages.filter((m) => m.roomId === roomId);
}
