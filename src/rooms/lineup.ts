// Tonight's lineup for the Double Halo ticker. Built only from the night's
// programming (DJ, schedule): never member data, so no school names appear.

import { formatTime } from '../explore/labels.ts';
import { isOpen, opensAt, type VenueState } from '../venue/machine.ts';
import { getRoom } from '../venue/rooms.ts';

export function lineup(state: VenueState): string[] {
  const items: string[] = [];
  const { dj } = state;
  if (dj && isOpen(state, dj.roomId)) {
    items.push(`${dj.name} live on the ${getRoom(dj.roomId).label}`, dj.genres.join(' · '));
  }
  const afterHours = opensAt(state, 'after-hours');
  if (afterHours !== null) items.push(`After Hours opens ${formatTime(afterHours)}`);
  else if (isOpen(state, 'after-hours')) items.push('After Hours is open');
  items.push(`Doors close ${formatTime(state.schedule.closesAt)}`, 'Every campus. One night.');
  return items;
}
