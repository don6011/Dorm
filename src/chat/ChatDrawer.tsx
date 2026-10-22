// The room chat drawer: peek → half → full. Drag the handle, or tap it to
// toggle size. Ported from the zip build. Authors render through PersonTap,
// so every chat line is two taps from block, mute and report.

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react';

import { PersonTap } from '../people/PersonTap.tsx';
import { visibleMessages } from '../social/social.ts';
import { useSocial } from '../social/SocialProvider.tsx';
import type { Room } from '../venue/rooms.ts';
import { useVenue } from '../venue/VenueProvider.tsx';
import { canPost, MAX_MESSAGE_LENGTH } from './chat.ts';
import { useChat } from './ChatProvider.tsx';

export type DrawerSize = 'peek' | 'half' | 'full';

function useRoomMessages(room: Room) {
  const { messages } = useChat();
  const { state } = useSocial();
  return visibleMessages(state, messages(room.id));
}

export function ChatPeek({ room, onOpen }: { room: Room; onOpen: () => void }) {
  const { state } = useVenue();
  const msgs = useRoomMessages(room);
  const last = msgs[msgs.length - 1];
  // The latest line only. Names live inside the drawer, where each is a PersonTap
  // (a name here would be a button inside this button).
  const line = !last ? 'Nobody has said anything yet' : last.authorId === state.viewer.profile.id ? `You: ${last.body}` : last.body;

  return (
    <button className="chat-peek" onClick={onOpen} aria-label={`Open ${room.label} chat`}>
      <span className="live-dot" aria-hidden="true" />
      <span className="chat-peek-text">
        <span className="chat-peek-title">{room.label} chat</span>
        <span className="chat-peek-line">{line}</span>
      </span>
      <span aria-hidden="true">⌃</span>
    </button>
  );
}

export function ChatDrawer({ room, size, onSize }: { room: Room; size: Exclude<DrawerSize, 'peek'>; onSize: (s: DrawerSize) => void }) {
  const { state } = useVenue();
  const { member } = useSocial();
  const { send } = useChat();
  const msgs = useRoomMessages(room);
  const me = state.viewer.profile;
  // Closed rooms are read-only: the history stays, the composer goes.
  const readOnly = !canPost(state, room.id);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; h: number; parent: number; moved: boolean } | null>(null);
  const [dragH, setDragH] = useState<number | null>(null);

  // Stick to the newest message.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, size]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onSize('peek');
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSize]);

  const onDown = (e: PointerEvent) => {
    const el = sheetRef.current;
    if (!el?.parentElement) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { y: e.clientY, h: el.getBoundingClientRect().height, parent: window.innerHeight, moved: false };
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;
    if (Math.abs(dy) > 6) d.moved = true;
    if (d.moved) setDragH(Math.min(d.parent - 40, Math.max(80, d.h + dy)));
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      onSize(size === 'full' ? 'half' : 'full');
      return;
    }
    const frac = (dragH ?? d.h) / d.parent;
    setDragH(null);
    onSize(frac < 0.3 ? 'peek' : frac < 0.75 ? 'half' : 'full');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    send(room.id, draft);
    setDraft('');
  };

  return (
    <div
      ref={sheetRef}
      className={`chat-drawer chat-drawer--${size}${dragH !== null ? ' dragging' : ''}`}
      style={dragH !== null ? { height: dragH } : undefined}
      role="region"
      aria-label={`${room.label} chat`}
    >
      <button
        className="chat-grab"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        aria-label={size === 'full' ? 'Shrink chat to half height' : 'Expand chat'}
      >
        <span />
      </button>
      <div className="chat-head">
        <span className="chat-title">{room.label} chat</span>
        <button className="icon-button" onClick={() => onSize('peek')} aria-label="Collapse chat">
          ⌄
        </button>
      </div>

      <div ref={listRef} className="chat-list" aria-live="polite">
        {msgs.length === 0 && <p className="chat-empty">Quiet in here. Say the first thing.</p>}
        {msgs.map((m) => {
          const mine = m.authorId === me.id;
          const author = mine ? null : member(m.authorId);
          if (!mine && !author) return null;
          return (
            <div key={m.id} className={`msg${mine ? ' msg--mine' : ''}`}>
              {author && <PersonTap member={author} variant="avatar" />}
              <div className="msg-col">
                <span className="msg-meta">
                  {author ? <PersonTap member={author} variant="name" /> : <strong>You</strong>}
                  {author && <span> · {author.campus}</span>}
                </span>
                <span className="bubble">{m.body}</span>
              </div>
            </div>
          );
        })}
      </div>

      {readOnly ? (
        <p className="chat-closed" role="status">
          This room has closed for the night
        </p>
      ) : (
      <form className="composer" onSubmit={submit}>
        <label htmlFor={`composer-${room.id}`} className="sr-only">
          Message {room.label}
        </label>
        <input
          id={`composer-${room.id}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Say something ${room.crowd}`}
          enterKeyHint="send"
          autoComplete="off"
          maxLength={MAX_MESSAGE_LENGTH}
          onFocus={() => size === 'half' && onSize('full')}
        />
        <button type="submit" className="send" aria-label="Send" disabled={!draft.trim()}>
          ➤
        </button>
      </form>
      )}
    </div>
  );
}
