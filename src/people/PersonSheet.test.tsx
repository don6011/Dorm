// @vitest-environment jsdom
// Rule 6: block, mute and report are reachable in two taps from any surface
// where another member appears. Each fireEvent.click below is one tap.

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { afterEach, test } from 'vitest';

import { MOCK_VIEWERS } from '../data/mock.ts';
import { BottomNav } from '../nav/BottomNav.tsx';
import { goTo, people, person, renderApp, sheet } from '../testing/renderApp.tsx';

afterEach(cleanup);

const joinFloor = () => fireEvent.click(screen.getByRole('button', { name: 'Join the floor' }));
const enterSuite = () => fireEvent.click(screen.getByRole('button', { name: /^The Suite/ }));
const enterBooth = () => {
  enterSuite();
  fireEvent.click(screen.getByRole('button', { name: 'Join Suite Booth' }));
};
const openChat = (room: string) => fireEvent.click(screen.getByRole('button', { name: `Open ${room} chat` }));

/** Every surface that shows other members, how to get there, and someone on it. */
const SURFACES = [
  { where: 'People row', name: 'Marcus', open: () => goTo('People') },
  { where: 'People row, presence masked', name: 'Dev', open: () => goTo('People') },
  { where: 'Messages row avatar', name: 'Aaliyah', open: () => goTo('Messages') },
  { where: 'conversation header', name: 'Aaliyah', open: () => (goTo('Messages'), fireEvent.click(screen.getByRole('button', { name: /^Conversation with Aaliyah/ }))) },
  { where: 'conversation header, presence masked', name: 'Dev', open: () => (goTo('Messages'), fireEvent.click(screen.getByRole('button', { name: /^Conversation with Dev/ }))) },
  { where: 'Main Floor roster avatar', name: 'Kofi', open: () => {} },
  { where: 'chat author avatar', name: 'Jade', open: joinFloor },
  { where: 'chat author name', name: 'Jade', open: joinFloor, pick: 1 },
  { where: 'Suite roster avatar', name: 'Ava', open: enterSuite },
  { where: 'Suite chat author', name: 'Dev', open: () => (enterSuite(), openChat('The Suite')) },
  { where: 'Booth roster avatar', name: 'Imani', open: enterBooth },
  { where: 'Booth chat author name', name: 'Imani', open: () => (enterBooth(), openChat('Suite Booth')), pick: 1 },
] as const;

for (const surface of SURFACES) {
  const { where, name, open } = surface;
  const pick = 'pick' in surface ? surface.pick : 0;
  for (const action of ['Mute', 'Block', 'Report'] as const) {
    test(`${where}: ${action} ${name} takes two taps`, () => {
      renderApp();
      open();
      fireEvent.click(people(name)[pick]); // tap 1
      const dialog = sheet()!;
      assert.ok(dialog !== null, 'sheet opened');
      fireEvent.click(within(dialog).getByRole('button', { name: action })); // tap 2

      if (action === 'Mute') within(sheet()!).getByText(/^Muted\./);
      if (action === 'Report') within(sheet()!).getByText(/^Reported\./);
      if (action === 'Block') {
        assert.ok(sheet() === null, 'sheet closes');
        assert.match(screen.getByRole('status').textContent!, new RegExp(`Blocked ${name}\\.`));
        assert.ok(person(name) === null, 'gone from this surface');
      }
    });
  }
}

test('block hides the member on every tab; Undo brings them back', () => {
  renderApp();
  goTo('People');
  fireEvent.click(person('Aaliyah')!);
  fireEvent.click(within(sheet()!).getByRole('button', { name: 'Block' }));
  assert.ok(person('Aaliyah') === null, 'People');
  goTo('Messages');
  assert.ok(person('Aaliyah') === null, 'Messages');

  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  assert.ok(person('Aaliyah') !== null, 'Messages after undo');
  goTo('People');
  assert.ok(person('Aaliyah') !== null, 'People after undo');
});

test('mute hides their messages but keeps them listed', () => {
  renderApp();
  goTo('Messages');
  screen.getByText('you on the floor yet?');
  fireEvent.click(person('Aaliyah')!);
  fireEvent.click(within(sheet()!).getByRole('button', { name: 'Mute' }));
  fireEvent.click(document.querySelector('.sheet-backdrop')!);
  assert.ok(screen.queryByText('you on the floor yet?') === null);
  assert.ok(person('Aaliyah') !== null);
});

test('the sheet never reveals age: a Suite member reads "In The Dorm" to an under-21 viewer', () => {
  renderApp({ viewer: MOCK_VIEWERS.under21WithSuitePass });
  goTo('People');
  const row = person('Dev')!;
  within(row).getByText('In The Dorm');
  fireEvent.click(row);
  const text = sheet()!.textContent!;
  assert.match(text, /In The Dorm/);
  assert.doesNotMatch(text, /Suite|21\+?|\bage\b|birth/i);
});

test('Message is disabled until connected, with a hint; Connect sends a request', () => {
  renderApp();
  goTo('People');
  fireEvent.click(person('Leo')!);
  const dialog = sheet()!;
  const message = within(dialog).getByRole('button', { name: 'Message' }) as HTMLButtonElement;
  assert.equal(message.disabled, true);
  within(dialog).getByText("You can message Leo once you're connected.");
  fireEvent.click(within(dialog).getByRole('button', { name: 'Connect' }));
  assert.ok(within(dialog).getByRole('button', { name: 'Requested' }));

  fireEvent.click(dialog.parentElement!);
  fireEvent.click(person('Aaliyah')!);
  const connected = within(sheet()!).getByRole('button', { name: 'Message' }) as HTMLButtonElement;
  assert.equal(connected.disabled, false);
});

test('bottom nav: exactly four tabs, active one marked, hidden when asked', () => {
  renderApp();
  const nav = screen.getByRole('navigation', { name: 'Main' });
  const tabs = within(nav).getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-current')]);
  assert.deepEqual(tabs, [['Home', 'page'], ['People', null], ['Messages', null], ['Me', null]]);
  goTo('Me');
  assert.equal(within(nav).getByRole('button', { name: 'Me' }).getAttribute('aria-current'), 'page');

  cleanup();
  render(<BottomNav active="home" onSelect={() => {}} hidden />);
  assert.ok(screen.queryByRole('navigation') === null);
});

test('member names render only through src/people (so every person-tap opens the sheet)', () => {
  const src = join(import.meta.dirname, '..');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx$/.test(f) && !/\.test\.tsx$/.test(f)) files.push(p);
    }
  };
  walk(src);
  const offenders = files.filter((f) => !f.includes(`${join(src, 'people')}`) && readFileSync(f, 'utf8').includes('displayName'));
  assert.deepEqual(offenders.map((f) => f.slice(src.length + 1)), []);
});
