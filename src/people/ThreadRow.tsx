// A Messages row. The avatar is a PersonTap (two taps to block, mute, report);
// the rest of the row opens the conversation.

import { useId } from 'react';

import type { PublicMember } from '../venue/machine.ts';
import { PersonTap } from './PersonTap.tsx';

export function ThreadRow({ member, preview, unread, onOpen }: { member: PublicMember; preview: string; unread: boolean; onOpen: () => void }) {
  const previewId = useId();
  return (
    <div className="thread-row">
      <PersonTap member={member} variant="avatar" />
      <button
        className="thread-open"
        onClick={onOpen}
        aria-label={`Conversation with ${member.displayName}${unread ? ', unread' : ''}`}
        aria-describedby={previewId}
      >
        <span className="person-row-text">
          <span className="person-row-name">{member.displayName}</span>
          <span id={previewId} className="preview">
            {preview}
          </span>
        </span>
        {unread && <span className="unread-dot" aria-hidden="true" />}
      </button>
    </div>
  );
}
