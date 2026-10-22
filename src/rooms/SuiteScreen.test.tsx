// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import assert from 'node:assert/strict';
import { afterEach, test } from 'vitest';

import { MOCK_MENUS, MOCK_VIEWERS, TEST_NIGHT, TEST_TIMES } from '../data/mock.ts';
import { renderApp } from '../testing/renderApp.tsx';
import { VenueProvider } from '../venue/VenueProvider.tsx';
import { MenuSheet } from './Menu.tsx';

afterEach(cleanup);

const heading = () => screen.queryByRole('heading', { level: 1 })?.textContent ?? null;
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const suiteDoor = () => button(/^The Suite/);
const door = () => screen.queryByRole('dialog', { name: 'The Suite' });
const ALCOHOL = Object.values(MOCK_MENUS).flatMap((items) => items!.filter((i) => i.alcohol).map((i) => i.name));
const ZERO_PROOF_BAR = MOCK_MENUS.bar!.filter((i) => !i.alcohol).map((i) => i.name);

test('21+ with a pass walks into The Suite; the booth opens from inside; back goes up one level', () => {
  renderApp();
  fireEvent.click(suiteDoor());
  assert.equal(heading(), 'The Suite');
  screen.getByText('VIP');
  fireEvent.click(button('Join Suite Booth'));
  assert.equal(heading(), 'Suite Booth');
  screen.getByText('Inside The Suite');
  fireEvent.click(button('‹ The Suite'));
  assert.equal(heading(), 'The Suite');
  fireEvent.click(button('‹ Main Floor'));
  assert.equal(heading(), 'Main Floor');
});

test('the booth is not reachable from outside The Suite, even with a pass', () => {
  renderApp();
  fireEvent.click(button('Explore The Dorm'));
  const row = screen.getByRole('button', { name: /^Suite Booth/ });
  assert.match(row.getAttribute('aria-label')!, /Via The Suite\. Enter through The Suite\./);
  assert.equal(row.getAttribute('aria-disabled'), 'true');
  fireEvent.click(row);
  assert.ok(screen.queryByRole('dialog', { name: 'Explore The Dorm' }) !== null, 'nothing happened');
});

test('21+ without a pass: the door offers a pass request and the waitlist, shows the count, never who is inside', () => {
  renderApp({ viewer: MOCK_VIEWERS.over21NoPass });
  fireEvent.click(suiteDoor());
  const d = door()!;
  within(d).getByText('31 inside');
  assert.equal(within(d).queryAllByRole('button', { name: /open profile/ }).length, 0, 'no roster');
  fireEvent.click(within(d).getByRole('button', { name: 'Request a pass' }));
  fireEvent.click(within(d).getByRole('button', { name: 'Join the waitlist' }));
  assert.equal((within(d).getByRole('button', { name: 'Pass requested' }) as HTMLButtonElement).disabled, true);
  assert.equal((within(d).getByRole('button', { name: 'On the waitlist' }) as HTMLButtonElement).disabled, true);
  fireEvent.keyDown(document.body, { key: 'Escape' });
  assert.ok(door() === null);
  assert.equal(heading(), 'Main Floor', 'still outside');
});

test('a pass but The Suite is full: the waitlist only', () => {
  renderApp({ occupancy: { suite: 40 } });
  fireEvent.click(suiteDoor());
  const d = door()!;
  within(d).getByText('The Suite is full right now.');
  assert.ok(within(d).queryByRole('button', { name: 'Request a pass' }) === null);
  within(d).getByRole('button', { name: 'Join the waitlist' });
});

test('Explore opens the same door for The Suite; under 21 gets no door anywhere', () => {
  renderApp({ viewer: MOCK_VIEWERS.over21NoPass });
  fireEvent.click(button('Explore The Dorm'));
  fireEvent.click(screen.getByRole('button', { name: /^The Suite\./ }));
  assert.ok(door() !== null);
  cleanup();

  renderApp({ viewer: MOCK_VIEWERS.under21WithSuitePass });
  fireEvent.click(suiteDoor());
  assert.ok(door() === null, 'hotspot: reason in place, no door');
  fireEvent.click(button('Explore The Dorm'));
  fireEvent.click(screen.getByRole('button', { name: /^The Suite\./ }));
  assert.ok(door() === null, 'Explore: no door');
});

test('rule 3 at The Bar: under 21 sees the zero-proof list and nothing alcohol-identified', () => {
  renderApp({ viewer: MOCK_VIEWERS.under21WithSuitePass });
  fireEvent.click(button(/^The Bar/));
  fireEvent.click(button('Menu'));
  const menu = screen.getByRole('dialog', { name: 'The Bar menu' });
  for (const name of ZERO_PROOF_BAR) within(menu).getByText(name);
  for (const name of ALCOHOL) assert.ok(!menu.textContent!.includes(name), name);
  assert.ok(within(menu).queryByRole('heading', { name: '21+' }) === null, 'no 21+ section');
});

test('21+ at The Bar and in The Suite see both lists', () => {
  renderApp({ viewer: MOCK_VIEWERS.over21NoPass });
  fireEvent.click(button(/^The Bar/));
  fireEvent.click(button('Menu'));
  const bar = screen.getByRole('dialog', { name: 'The Bar menu' });
  within(bar).getByRole('heading', { name: '21+' });
  within(bar).getByText('House Paloma');
  cleanup();

  renderApp();
  fireEvent.click(suiteDoor());
  fireEvent.click(button('Menu'));
  within(screen.getByRole('dialog', { name: 'The Suite menu' })).getByText('Suite Negroni');
});

test('the Suite menu still goes through canSeeAlcohol: under 21 would see zero-proof only', () => {
  render(
    <VenueProvider viewer={MOCK_VIEWERS.under21WithSuitePass} schedule={TEST_NIGHT} menus={MOCK_MENUS} clock={() => TEST_TIMES.live}>
      <MenuSheet roomId="suite" onClose={() => {}} />
    </VenueProvider>,
  );
  const menu = screen.getByRole('dialog', { name: 'The Suite menu' });
  within(menu).getByText('Gold Hour');
  for (const name of ALCOHOL) assert.ok(!menu.textContent!.includes(name), name);
});
