// A direct-message conversation: full height over the tab it was opened from,
// nav hidden, composer above the keyboard (--kb, see useKeyboardInset). The
// header is a PersonTap, so block, mute and report are two taps away. Who may
// message whom is canMessage's call in social.ts; this screen only asks.

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';

import { MAX_MESSAGE_LENGTH } from '../chat/chat.ts';
import { PersonTap } from '../people/PersonTap.tsx';
import { canMessage, conversation, isMuted } from '../social/social.ts';
import { useSocial } from '../social/SocialProvider.tsx';
import { useVenue } from '../venue/VenueProvider.tsx';
import { messageStamp, startsGroup } from './stamps.ts';

export function DmScreen({ memberId, backLabel, onBack }: { memberId: string; backLabel: string; onBack: () => void }) {
  const { state, dispatch, member, sendDm } = useSocial();
  const { state: venue } = useVenue();
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const msgs = conversation(state, memberId);
  const latest = state.dms.findLast((m) => m.withId === memberId)?.id;

  // Open means read, including anything that arrives while it's open.
  useEffect(() => {
    dispatch({ type: 'readThread', memberId });
  }, [dispatch, memberId, latest]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onBack();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const m = member(memberId);
  if (!m) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    sendDm(memberId, draft);
    setDraft('');
  };

  return (
    <section className="dm" aria-label="Conversation">
      <header className="dm-head">
        <button className="back-button" onClick={onBack}>
          ‹ {backLabel}
        </button>
        <PersonTap member={m} variant="header" />
      </header>

      <div ref={listRef} className="chat-list" aria-live="polite">
        {isMuted(state, memberId) && <p className="dm-note">Muted. Their messages are hidden.</p>}
        {msgs.length === 0 && <p className="chat-empty">No messages yet. Say hi.</p>}
        {msgs.map((msg, i) => {
          const mine = msg.authorId !== memberId;
          // Text only: the body renders as text, so a link is just characters. No linkify.
          return (
            <Fragment key={msg.id}>
              {startsGroup(msgs[i - 1], msg) && (
                <time className="dm-stamp" dateTime={new Date(msg.sentAt).toISOString()}>
                  {messageStamp(msg.sentAt, venue.now)}
                </time>
              )}
              <div className={`msg${mine ? ' msg--mine' : ''}`}>
                <span className="bubble">{msg.body}</span>
              </div>
            </Fragment>
          );
        })}
      </div>

      {canMessage(state, memberId) ? (
        <form className="composer" onSubmit={submit}>
          <label htmlFor="dm-composer" className="sr-only">
            Write a message
          </label>
          <input
            id="dm-composer"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message"
            enterKeyHint="send"
            autoComplete="off"
            maxLength={MAX_MESSAGE_LENGTH}
          />
          <button type="submit" className="send" aria-label="Send" disabled={!draft.trim()}>
            ➤
          </button>
        </form>
      ) : (
        <p className="chat-closed">Messages are between connections.</p>
      )}
    </section>
  );
}
