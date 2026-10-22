import assert from 'node:assert/strict';
import { test } from 'vitest';

import { formatTime } from '../explore/labels.ts';
import { messageStamp, startsGroup } from './stamps.ts';

const at = (month: number, day: number, hour: number, minute = 0, year = 2026) => new Date(year, month, day, hour, minute).getTime();
const NOW = at(9, 15, 22); // Thursday, Oct 15

test('today reads as the time alone', () => {
  assert.equal(messageStamp(at(9, 15, 21, 42), NOW), formatTime(at(9, 15, 21, 42)));
  assert.equal(messageStamp(at(9, 15, 0, 5), NOW), formatTime(at(9, 15, 0, 5)), 'just after midnight');
});

test('days are calendar days: 11 PM last night is not "today" at 1 AM', () => {
  assert.equal(messageStamp(at(9, 15, 23), at(9, 16, 1)), `Thursday ${formatTime(at(9, 15, 23))}`);
});

test('this week reads as the weekday; a week or more back reads as the date', () => {
  assert.equal(messageStamp(at(9, 14, 21, 42), NOW), `Wednesday ${formatTime(at(9, 14, 21, 42))}`);
  assert.equal(messageStamp(at(9, 9, 21, 42), NOW), `Friday ${formatTime(at(9, 9, 21, 42))}`, '6 days');
  assert.equal(messageStamp(at(9, 8, 21, 42), NOW), `Oct 8, ${formatTime(at(9, 8, 21, 42))}`, '7 days');
  assert.equal(messageStamp(at(9, 7, 21, 42), NOW), `Oct 7, ${formatTime(at(9, 7, 21, 42))}`, '8 days');
  assert.equal(messageStamp(at(11, 30, 20, 0, 2025), NOW), `Dec 30, 2025, ${formatTime(at(11, 30, 20, 0, 2025))}`, 'last year');
});

test('a group starts at the first message, after a 30-minute gap, or on a new day', () => {
  const m = (t: number) => ({ sentAt: t });
  assert.equal(startsGroup(undefined, m(NOW)), true);
  assert.equal(startsGroup(m(NOW), m(NOW + 29 * 60_000)), false);
  assert.equal(startsGroup(m(NOW), m(NOW + 30 * 60_000)), true);
  assert.equal(startsGroup(m(at(9, 15, 23, 50)), m(at(9, 16, 0, 5))), true, 'across midnight');
});
