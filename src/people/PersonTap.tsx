// The only way the app shows another member. Every avatar, name, chat author,
// People row and invitation renders through PersonTap, so every one of them
// opens the same person sheet, where block, mute and report live (rule 6).
// A test fails if a member's name is rendered anywhere outside src/people/.

import type { ReactNode } from 'react';

import { presenceOf, type PresenceView, type PublicMember } from '../venue/machine.ts';
import { getRoom } from '../venue/rooms.ts';
import { useVenue } from '../venue/VenueProvider.tsx';
import { usePersonSheet } from './PersonSheet.tsx';

// Member colors: any hue but gold, which belongs to The Suite.
const AVATAR_HUES = ['#7b2ff7', '#3b6bff', '#d43fa8', '#2bb3a3', '#5a4bd6', '#e0567a'];

function hueFor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}

export function Avatar({ member, size = 40 }: { member: PublicMember; size?: number }) {
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.42, background: hueFor(member.id) }}
    >
      {member.displayName.charAt(0).toUpperCase()}
    </span>
  );
}

/** Same neutral token for every school: a letter in our palette, never school colors or marks. */
export function CampusMonogram({ campus }: { campus: string }) {
  return (
    <span className="monogram" aria-hidden="true">
      {campus.charAt(0).toUpperCase()}
    </span>
  );
}

function presenceText(view: PresenceView): string {
  if (view.kind === 'room') return getRoom(view.roomId).label;
  if (view.kind === 'masked') return 'In The Dorm';
  return 'Not in tonight';
}

export function PresenceChip({ memberId }: { memberId: string }) {
  const { state } = useVenue();
  const view = presenceOf(state, memberId);
  return <span className={`presence presence--${view.kind}`}>{presenceText(view)}</span>;
}

type Variant = 'row' | 'avatar' | 'name' | 'header';

export function PersonTap({
  member,
  variant = 'row',
  children,
}: {
  member: PublicMember;
  variant?: Variant;
  /** Secondary content for rows, e.g. presence or a message preview. */
  children?: ReactNode;
}) {
  const { open } = usePersonSheet();
  const onClick = () => open(member.id);
  const label = `${member.displayName}, open profile`;

  if (variant === 'avatar') {
    return (
      <button className="person-avatar" onClick={onClick} aria-label={label}>
        <Avatar member={member} />
      </button>
    );
  }
  if (variant === 'header') {
    // A conversation's header: who it's with and where, masked like everywhere else.
    return (
      <button className="person-header" onClick={onClick} aria-label={label}>
        <Avatar member={member} size={36} />
        <span className="person-row-text">
          <span className="person-row-name">{member.displayName}</span>
          <PresenceChip memberId={member.id} />
        </span>
      </button>
    );
  }
  if (variant === 'name') {
    return (
      <button className="person-name" onClick={onClick} aria-label={label}>
        {member.displayName}
      </button>
    );
  }
  return (
    <button className="person-row" onClick={onClick} aria-label={label}>
      <Avatar member={member} size={44} />
      <span className="person-row-text">
        <span className="person-row-name">{member.displayName}</span>
        {children}
      </span>
    </button>
  );
}

/** The viewer's own card on the Me tab. Not tappable: there's nothing to block. */
export function SelfCard({ member }: { member: PublicMember }) {
  return (
    <div className="self-card">
      <Avatar member={member} size={64} />
      <div className="self-card-text">
        <span className="self-card-name">{member.displayName}</span>
        <span className="campus-line">
          <CampusMonogram campus={member.campus} />
          {member.campus}
        </span>
        <span className="verified">✓ Verified student</span>
      </div>
    </div>
  );
}
