// The person sheet: one sheet for every member, wherever they were tapped.
// Safety actions are one tap inside it, so two taps from any surface (rule 6).
// Shows who someone is and where; never age, DOB or 21+ status.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { canMessage, connectionStatus, isMuted } from '../social/social.ts';
import { useSocial } from '../social/SocialProvider.tsx';
import { Avatar, CampusMonogram, PresenceChip } from './PersonTap.tsx';

const UNDO_MS = 6000;

interface PersonSheetContextValue {
  open: (memberId: string) => void;
}

const PersonSheetContext = createContext<PersonSheetContextValue | null>(null);

// eslint-disable-next-line react/only-export-components -- the hook belongs with its provider
export function usePersonSheet(): PersonSheetContextValue {
  const ctx = useContext(PersonSheetContext);
  if (!ctx) throw new Error('usePersonSheet must be used inside <PersonSheetProvider>');
  return ctx;
}

interface Toast {
  text: string;
  undoBlockOf?: string;
}

export function PersonSheetProvider({ onMessage, children }: { onMessage: (memberId: string) => void; children: ReactNode }) {
  const { dispatch, member } = useSocial();
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), UNDO_MS);
    return () => clearTimeout(id);
  }, [toast]);

  const open = useCallback((memberId: string) => setOpenId(memberId), []);
  const close = useCallback(() => setOpenId(null), []);

  const block = (memberId: string) => {
    const name = member(memberId)?.displayName ?? 'Member';
    dispatch({ type: 'block', memberId });
    setOpenId(null);
    setToast({ text: `Blocked ${name}. They won't be told.`, undoBlockOf: memberId });
  };

  const undo = (memberId: string) => {
    dispatch({ type: 'undoBlock', memberId });
    setToast(null);
  };

  const shown = openId ? member(openId) : undefined;

  return (
    <PersonSheetContext.Provider value={{ open }}>
      {children}
      {shown && (
        <PersonSheet
          key={shown.id}
          memberId={shown.id}
          onClose={close}
          onBlock={() => block(shown.id)}
          onMessage={() => {
            close();
            onMessage(shown.id);
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast.text}</span>
          {toast.undoBlockOf && (
            <button className="toast-action" onClick={() => undo(toast.undoBlockOf!)}>
              Undo
            </button>
          )}
        </div>
      )}
    </PersonSheetContext.Provider>
  );
}

function PersonSheet(props: { memberId: string; onClose: () => void; onBlock: () => void; onMessage: () => void }) {
  const { state, dispatch, member } = useSocial();
  const m = member(props.memberId)!;
  const [note, setNote] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { onClose } = props;

  useEffect(() => {
    headingRef.current?.focus();
    // Capture phase, and stop there: Escape closes this sheet only, not the
    // chat drawer or overlay underneath it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const status = connectionStatus(state, m.id);
  const messageable = canMessage(state, m.id);
  const muted = isMuted(state, m.id);

  const toggleMute = () => {
    dispatch({ type: 'toggleMute', memberId: m.id });
    setNote(muted ? `Unmuted ${m.displayName}.` : `Muted. You won't see ${m.displayName}'s messages. They aren't told.`);
  };
  const report = () => {
    dispatch({ type: 'report', memberId: m.id, at: Date.now() });
    setNote('Reported. Our team reviews it privately.');
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-sheet-name"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <Avatar member={m} size={64} />
          <div className="sheet-id">
            <h2 id="person-sheet-name" ref={headingRef} tabIndex={-1}>
              {m.displayName}
            </h2>
            <span className="campus-line">
              <CampusMonogram campus={m.campus} />
              {m.campus}
              <span className="verified">✓ Verified student</span>
            </span>
            <PresenceChip memberId={m.id} />
          </div>
        </div>

        <div className="sheet-actions">
          <button
            className="btn btn--primary"
            disabled={status !== 'none'}
            onClick={() => dispatch({ type: 'connect', memberId: m.id })}
          >
            {status === 'none' ? 'Connect' : status === 'pending' ? 'Requested' : 'Connected'}
          </button>
          <button
            className="btn"
            disabled={!messageable}
            aria-describedby={!messageable ? 'message-hint' : undefined}
            onClick={props.onMessage}
          >
            Message
          </button>
        </div>
        {!messageable && (
          <p id="message-hint" className="hint">
            You can message {m.displayName} once you're connected.
          </p>
        )}

        {note && (
          <p className="sheet-note" role="status">
            {note}
          </p>
        )}

        <div className="safety" role="group" aria-label="Safety">
          <button onClick={toggleMute}>{muted ? 'Unmute' : 'Mute'}</button>
          <button onClick={props.onBlock}>Block</button>
          <button className="safety-report" onClick={report}>
            Report
          </button>
        </div>
      </div>
    </div>
  );
}
