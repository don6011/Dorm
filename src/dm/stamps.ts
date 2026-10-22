// Light timestamps for direct messages. A stamp starts a group of messages;
// bubbles never carry their own. Days are calendar days in local time.

import { formatTime } from '../explore/labels.ts';

/** A new group starts when this much time passes between messages, or the day changes. */
export const GROUP_GAP_MS = 30 * 60_000;

const DAY_MS = 86_400_000;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Calendar days from one moment to a later one (rounded, so DST changes don't count). */
function daysBetween(earlier: number, later: number): number {
  return Math.round((startOfDay(later) - startOfDay(earlier)) / DAY_MS);
}

/** "9:42 PM" today, "Friday 9:42 PM" within the last six days, "Oct 9, 9:42 PM" before that (plus the year if it isn't this one). */
export function messageStamp(at: number, now: number): string {
  const days = daysBetween(at, now);
  const time = formatTime(at);
  if (days <= 0) return time;
  const d = new Date(at);
  if (days <= 6) return `${d.toLocaleDateString([], { weekday: 'long' })} ${time}`;
  const year = d.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric';
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year })}, ${time}`;
}

/** Whether a message starts a new group, and so gets a stamp above it. */
export function startsGroup(prev: { sentAt: number } | undefined, msg: { sentAt: number }): boolean {
  return !prev || msg.sentAt - prev.sentAt >= GROUP_GAP_MS || daysBetween(prev.sentAt, msg.sentAt) !== 0;
}
