// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import assert from 'node:assert/strict';
import { useRef } from 'react';
import { afterEach, test, vi } from 'vitest';

import { useKeyboardInset } from '../chat/useKeyboardInset.ts';
import { MOCK_MEMBERS, MOCK_VIEWERS, TEST_TIMES } from '../data/mock.ts';
import { nav, people, person, renderApp, sheet } from '../testing/renderApp.tsx';
import type { Viewer } from '../venue/machine.ts';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const heading = () => screen.queryByRole('heading', { level: 1 })?.textContent ?? null;
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const status = () => screen.getByRole('status').textContent;
const suiteDoor = () => button(/^The Suite/);
const crowd = () => document.querySelector('.crowd')?.textContent ?? '';

test('Home shows the Main Floor scene when it is open, and the doors screen before', () => {
  renderApp();
  assert.equal(heading(), 'Main Floor');
  button('Join the floor');
  cleanup();
  renderApp({ now: TEST_TIMES.beforeDoors });
  assert.equal(heading(), null);
  screen.getByText('Doors closed');
});

test('Join the floor enters, opens the chat and hides the nav; collapsing brings it back', () => {
  renderApp();
  assert.ok(nav() !== null);
  fireEvent.click(button('Join the floor'));
  screen.getByRole('region', { name: 'Main Floor chat' });
  assert.ok(nav() === null, 'nav hidden while chat is open');
  fireEvent.click(button('Collapse chat'));
  assert.ok(nav() !== null, 'nav back at peek');
  button('Open Main Floor chat');
  assert.match(crowd(), /^1,241 on the floor/, 'you count once you join');
});

test('under 21: The Suite door reads 21+, shows no count, and explains in place', () => {
  renderApp({ viewer: MOCK_VIEWERS.under21WithSuitePass });
  assert.equal(suiteDoor().textContent, '🔒︎The Suite · 21+');
  fireEvent.click(suiteDoor());
  assert.equal(status(), 'The Suite is 21+.');
  assert.equal(heading(), 'Main Floor', 'did not move');
});

test('21+ without a pass: "Entry by guest pass", and age is never the headline', () => {
  renderApp({ viewer: MOCK_VIEWERS.over21NoPass });
  assert.doesNotMatch(suiteDoor().textContent!, /21/);
  fireEvent.click(suiteDoor());
  assert.equal(status(), 'Entry by guest pass.');
  assert.equal(heading(), 'Main Floor');
});

test('21+ with a pass walks into The Suite; back returns to Main Floor', () => {
  renderApp();
  fireEvent.click(suiteDoor());
  assert.equal(heading(), 'The Suite');
  fireEvent.click(button('‹ Main Floor'));
  assert.equal(heading(), 'Main Floor');
  button('Open Main Floor chat');
});

test("The Bar is a child of Main Floor: its back button returns there", () => {
  renderApp({ viewer: MOCK_VIEWERS.under21WithSuitePass });
  fireEvent.click(button(/^The Bar/));
  assert.equal(heading(), 'The Bar');
  screen.getByText('end of the bar if anyone wants to talk');
  fireEvent.click(button('‹ Main Floor'));
  assert.equal(heading(), 'Main Floor');
});

test('"from your campus" counts people on the floor who share your campus, and hides at 0', () => {
  renderApp(); // Howard: Aaliyah, Kofi, Tre on the floor
  assert.match(crowd(), /· 3 from your campus$/);
  fireEvent.click(person('Kofi')!);
  fireEvent.click(within(sheet()!).getByRole('button', { name: 'Block' }));
  assert.match(crowd(), /· 2 from your campus$/, 'blocked members are not counted');
  cleanup();

  const elsewhere: Viewer = { ...MOCK_VIEWERS.over21NoPass, profile: { id: 'v-x', displayName: 'X', campus: 'Nowhere State' } };
  renderApp({ viewer: elsewhere });
  assert.doesNotMatch(crowd(), /from your campus/);
});

test('chat: muted members vanish, you can post, empty messages cannot be sent', () => {
  renderApp();
  fireEvent.click(button('Join the floor'));
  const chat = screen.getByRole('region', { name: 'Main Floor chat' });
  within(chat).getByText('this set is unreal');

  fireEvent.click(people('Aaliyah')[1]); // her name on the message
  fireEvent.click(within(sheet()!).getByRole('button', { name: 'Mute' }));
  fireEvent.keyDown(document.body, { key: 'Escape' });
  assert.ok(sheet() === null, 'Escape closed the sheet');
  assert.ok(chat.isConnected, '...and only the sheet: the chat stays open');
  assert.ok(within(chat).queryByText('this set is unreal') === null);

  const send = within(chat).getByRole('button', { name: 'Send' }) as HTMLButtonElement;
  assert.equal(send.disabled, true);
  fireEvent.change(within(chat).getByLabelText('Message Main Floor'), { target: { value: '  hello floor  ' } });
  fireEvent.click(send);
  within(chat).getByText('hello floor');
  within(chat).getByText('You');
});

test('the Double Halo ticker shows tonight, never a school name', () => {
  renderApp();
  const band = screen.getByRole('marquee');
  const text = band.getAttribute('aria-label')!;
  assert.match(text, /DJ Elevate live on the Main Floor/);
  assert.match(text, /After Hours opens/);
  for (const campus of new Set(MOCK_MEMBERS.map((m) => m.campus))) assert.ok(!text.includes(campus), campus);
});

test('keyboard inset: --kb follows the iOS keyboard', async () => {
  const vv = Object.assign(new EventTarget(), { height: 844, offsetTop: 0 });
  vi.stubGlobal('visualViewport', vv);
  vi.stubGlobal('innerHeight', 844);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));

  function Probe() {
    const ref = useRef<HTMLDivElement>(null);
    useKeyboardInset(ref);
    return <div data-testid="root" ref={ref} />;
  }
  render(<Probe />);
  const root = screen.getByTestId('root');
  const flush = () => act(() => new Promise((r) => setTimeout(r, 5)));

  await flush();
  assert.equal(root.style.getPropertyValue('--kb'), '0px');
  vv.height = 500;
  vv.dispatchEvent(new Event('resize'));
  await flush();
  assert.equal(root.style.getPropertyValue('--kb'), '344px');
  assert.ok(root.classList.contains('kb-open'));
});
