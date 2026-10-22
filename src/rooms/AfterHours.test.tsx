// @vitest-environment jsdom
// The night's transitions, driven by the clock through the machine's own tick.
// Every time on screen is computed from the schedule here too, never typed in.

import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import assert from 'node:assert/strict';
import { afterEach, test } from 'vitest';

import { buildNightSchedule, MOCK_VIEWERS, TEST_NIGHT, TEST_TIMES } from '../data/mock.ts';
import { formatTime } from '../explore/labels.ts';
import { people, renderApp } from '../testing/renderApp.tsx';

afterEach(cleanup);

const heading = () => screen.queryByRole('heading', { level: 1 })?.textContent ?? null;
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const has = (text: string) => document.body.textContent!.includes(text);
const joinFloor = () => {
  fireEvent.click(button('Join the floor'));
  fireEvent.click(button('Collapse chat'));
};
const LAST_CALL = TEST_NIGHT.lastCallAt + 2 * 60_000;

test('before After Hours: Home shows when it opens, with Remind me', () => {
  renderApp();
  screen.getByText(`After Hours · opens ${formatTime(TEST_NIGHT.afterHoursAt)}`);
  fireEvent.click(button('Remind me'));
  assert.equal(button('Reminder set').getAttribute('aria-pressed'), 'true');
});

test('Explore: tapping After Hours before it opens sets a reminder', () => {
  renderApp();
  fireEvent.click(button('Explore The Dorm'));
  const row = screen.getByRole('button', { name: /^After Hours\./ });
  assert.match(row.getAttribute('aria-label')!, /Tap for a reminder/);
  fireEvent.click(row);
  assert.match(screen.getByRole('button', { name: /^After Hours\./ }).getAttribute('aria-label')!, /Reminder set/);
});

test('last call shows in a closing room, not in The Suite', () => {
  const app = renderApp();
  joinFloor();
  app.tick(LAST_CALL);
  screen.getByText(`Last call · the night moves downstairs at ${formatTime(TEST_NIGHT.afterHoursAt)}`);
  cleanup();

  const suite = renderApp();
  fireEvent.click(button(/^The Suite/));
  suite.tick(LAST_CALL);
  assert.equal(heading(), 'The Suite');
  assert.ok(!has('Last call'));
});

test('at After Hours: your room closes, its chat goes read-only, and Head downstairs walks you in', () => {
  const app = renderApp();
  joinFloor();
  app.tick(TEST_TIMES.afterHours);
  assert.equal(heading(), 'Main Floor');
  screen.getByText('Main Floor has closed for the night.');

  fireEvent.click(button('Open Main Floor chat'));
  const chat = screen.getByRole('region', { name: 'Main Floor chat' });
  within(chat).getByText('This room has closed for the night');
  within(chat).getByText('this set is unreal');
  assert.ok(within(chat).queryByRole('textbox') === null, 'no composer');
  fireEvent.click(button('Collapse chat'));

  fireEvent.click(button('Head downstairs'));
  assert.equal(heading(), 'After Hours');
  assert.equal(document.querySelector('.room-screen')!.getAttribute('data-palette'), 'midnight');
  assert.ok(people('Aaliyah').length > 0, 'the crowd moved downstairs too');
  button('Open After Hours chat');
});

test('in The Suite at After Hours: no prompt, and back leads to After Hours', () => {
  const app = renderApp();
  fireEvent.click(button(/^The Suite/));
  app.tick(TEST_TIMES.afterHours);
  assert.equal(heading(), 'The Suite');
  assert.ok(!has('has closed for the night'));
  fireEvent.click(button('‹ After Hours'));
  assert.equal(heading(), 'After Hours');
});

test('in no room at After Hours: Home shows After Hours with Head downstairs', () => {
  renderApp({ now: TEST_TIMES.afterHours });
  assert.equal(heading(), 'After Hours');
  fireEvent.click(button('Head downstairs'));
  screen.getByRole('region', { name: 'After Hours chat' });
});

test('a reminder fires as a notice when After Hours opens, and going in clears it', () => {
  const app = renderApp({ viewer: MOCK_VIEWERS.under21WithSuitePass });
  fireEvent.click(button('Remind me'));
  app.tick(TEST_TIMES.afterHours);
  const notice = document.querySelector('.notice-bar')!;
  assert.match(notice.textContent!, /After Hours is open/);
  fireEvent.click(within(notice as HTMLElement).getByRole('button', { name: 'Head downstairs' }));
  assert.equal(heading(), 'After Hours');
  assert.ok(document.querySelector('.notice-bar') === null);
});

test("end of night: That's the night, with the next night's lineup", () => {
  const app = renderApp();
  joinFloor();
  app.tick(TEST_TIMES.afterHours);
  app.tick(TEST_TIMES.afterClose);
  screen.getByText("That's the night.");
  assert.ok(has('DJ Nova'));
  assert.ok(has(`doors ${formatTime(TEST_NIGHT.opensAt)}`), 'next night uses the same doors time');
});

test('every time on screen comes from the schedule: move the night and the copy follows', () => {
  const late = buildNightSchedule(new Date(2026, 9, 15), { opens: 20, afterHours: 25, closes: 28 });
  assert.notEqual(late.afterHoursAt, TEST_NIGHT.afterHoursAt);

  renderApp({ schedule: late, now: late.opensAt - 30 * 60_000 });
  screen.getByText(`Doors open ${formatTime(late.opensAt)}`);
  cleanup();

  const app = renderApp({ schedule: late, now: late.opensAt + 60 * 60_000 });
  screen.getByText(`After Hours · opens ${formatTime(late.afterHoursAt)}`);
  assert.match(screen.getByRole('marquee').getAttribute('aria-label')!, new RegExp(`After Hours opens ${formatTime(late.afterHoursAt)}`));
  joinFloor();
  app.tick(late.lastCallAt + 60_000);
  screen.getByText(`Last call · the night moves downstairs at ${formatTime(late.afterHoursAt)}`);
  assert.ok(!has(`opens ${formatTime(TEST_NIGHT.afterHoursAt)}`), 'no trace of the old time');
});
