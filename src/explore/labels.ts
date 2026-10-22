// Turns the machine's answers into words. No rules here: every decision
// comes from canEnter / opensAt; this file only phrases them.

import { canEnter, opensAt, type Access, type VenueState } from '../venue/machine.ts';
import { getRoom, type RoomId } from '../venue/rooms.ts';

export type PillTone = 'go' | 'here' | 'locked' | 'closed';

export interface RoomStatus {
  /** null: nothing to say beyond the section the row sits in. */
  pill: string | null;
  tone: PillTone;
  /** Extra line under the tagline when the pill alone doesn't say why. */
  note: string | null;
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function roomStatus(state: VenueState, roomId: RoomId): RoomStatus {
  if (state.location === roomId) return { pill: "You're here", tone: 'here', note: null };
  const access = canEnter(state, roomId);
  if (access.ok) return { pill: 'Join', tone: 'go', note: null };

  const refusing = getRoom(access.roomId).label;
  const viaParent = access.roomId !== roomId;
  switch (access.reason) {
    case 'closed': {
      const at = opensAt(state, roomId);
      return at === null
        ? { pill: null, tone: 'closed', note: null } // the section divider says it
        : { pill: `Opens ${formatTime(at)}`, tone: 'closed', note: null };
    }
    case 'underage':
      return { pill: '21+', tone: 'locked', note: viaParent ? `Inside ${refusing}, which is 21+.` : null };
    case 'needsPass':
      return { pill: 'Guest pass', tone: 'locked', note: viaParent ? `Needs a guest pass for ${refusing}.` : 'Entry by guest pass.' };
    case 'throughParent': {
      const parent = getRoom(getRoom(access.roomId).parent!).label;
      return { pill: `Via ${parent}`, tone: 'locked', note: `Enter through ${parent}.` };
    }
    case 'full':
      return { pill: 'Full', tone: 'locked', note: 'At capacity. Check back soon.' };
    case 'unverified':
      return { pill: 'Verify .edu', tone: 'locked', note: 'Verify your .edu email to get in.' };
  }
}

/** One sentence for a refusal or a move-out, e.g. at midnight. */
export function describeDenial(denial: Extract<Access, { ok: false }>): string {
  const label = getRoom(denial.roomId).label;
  switch (denial.reason) {
    case 'closed':
      return `${label} is closed.`;
    case 'underage':
      return `${label} is 21+.`;
    case 'needsPass':
      return `${label} needs a guest pass.`;
    case 'throughParent':
      return `Enter ${label} through ${getRoom(getRoom(denial.roomId).parent!).label}.`;
    case 'full':
      return `${label} is full right now.`;
    case 'unverified':
      return 'Verify your .edu email to get in.';
  }
}

/**
 * The one-line reason shown in place when a locked door is tapped. Age comes
 * first in canEnter, so "is 21+" only ever reaches under-21 members; a 21+
 * member without a pass reads "Entry by guest pass." and never sees age.
 */
export function lockedReason(state: VenueState, denial: Extract<Access, { ok: false }>, roomId: RoomId): string {
  const label = getRoom(denial.roomId).label;
  switch (denial.reason) {
    case 'underage':
      return `${label} is 21+.`;
    case 'needsPass':
      return 'Entry by guest pass.';
    case 'throughParent':
      return `Enter through ${getRoom(getRoom(denial.roomId).parent!).label}.`;
    case 'full':
      return `${label} is full right now.`;
    case 'closed': {
      const at = opensAt(state, roomId);
      return at === null ? `${label} is closed for tonight.` : `Opens ${formatTime(at)}.`;
    }
    case 'unverified':
      return 'Verify your .edu email to get in.';
  }
}
