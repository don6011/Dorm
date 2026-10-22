// @vitest-environment jsdom
// Direct messages, end to end on mock data. Who may message whom is canMessage
// in social.ts; these check that every screen keeps to it.

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import assert from 'node:assert/strict';
import { afterEach, test } from 'vitest';

import { MOCK_DM_INCOMING, MOCK_VIEWERS, TEST_TIMES } from '../data/mock.ts';
import { DevRoot } from '../dev/DevRoot.tsx';
import { formatTime } from '../explore/labels.ts';
import { goTo, nav, person, renderApp, sheet } from '../testing/renderApp.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

/** The dev root, signed straight in the way ?viewer= does. */
const renderDev = () => {
  window.history.replaceState(null, '', '/?viewer=over21WithSuitePass');
  return render(<DevRoot />);
};

const button = (name: string | RegExp) => screen.getByRole('button', { name });
/** The part of a Messages row that opens the conversation. */
const row = (name: string) => screen.queryByRole('button', { name: new RegExp(`^Conversation with ${name}`) });
const open = (name: string) => fireEvent.click(row(name)!);
const dm = () => screen.queryByRole('region', { name: 'Conversation' });
const heading = () => screen.queryByRole('heading', { level: 1 })?.textContent ?? null;
const sheetButton = (name: string) => fireEvent.click(within(sheet()!).getByRole('button', { name }));
/** The Messages tab's dot: drawn, and described for screen readers. */
function tabDot(): boolean {
  const tab = within(nav()!).getByRole('button', { name: 'Messages' });
  const drawn = tab.querySelector('.nav-dot') !== null;
  const described = within(nav()!).queryByRole('button', { name: 'Messages', description: 'Unread messages' }) !== null;
  assert.equal(drawn, described, 'dot and description agree');
  return drawn;
}

test('unread: a dot on the tab and the row; opening the thread clears both; Back returns to Messages', () => {
  renderApp();
  assert.equal(tabDot(), true);
  goTo('Messages');
  assert.ok(row('Aaliyah, unread') !== null);
  assert.ok(row('Dev')!.getAttribute('aria-label') === 'Conversation with Dev', 'already read');

  open('Aaliyah');
  assert.ok(dm() !== null);
  assert.ok(nav() === null, 'nav hidden while a conversation is open');
  fireEvent.click(button('‹ Messages'));

  assert.equal(heading(), 'Messages');
  assert.equal(row('Aaliyah')!.getAttribute('aria-label'), 'Conversation with Aaliyah');
  assert.ok(document.querySelector('.unread-dot') === null);
  assert.equal(tabDot(), false);
});

test("the sheet's Message opens the conversation; Back returns to the tab you came from", () => {
  renderApp();
  goTo('People');
  fireEvent.click(person('Dev')!);
  sheetButton('Message');
  assert.ok(sheet() === null);
  within(dm()!).getByText('see you upstairs later');
  fireEvent.click(button('‹ People'));
  assert.equal(heading(), 'People tonight');
  cleanup();

  // From a chat author in a room: back to the room, its chat as you left it.
  renderApp();
  fireEvent.click(button('Join the floor'));
  const chat = screen.getByRole('region', { name: 'Main Floor chat' });
  fireEvent.click(within(chat).getAllByRole('button', { name: 'Aaliyah, open profile' })[0]);
  sheetButton('Message');
  within(dm()!).getByText('you on the floor yet?');
  fireEvent.click(button('‹ Home'));
  screen.getByRole('region', { name: 'Main Floor chat' });
});

test('no way to message a non-connection: Message stays disabled for pending and strangers', () => {
  renderApp();
  goTo('People');
  for (const name of ['Jade', 'Leo']) {
    fireEvent.click(person(name)!);
    const message = within(sheet()!).getByRole('button', { name: 'Message' }) as HTMLButtonElement;
    assert.equal(message.disabled, true, name);
    fireEvent.click(message);
    assert.ok(dm() === null, name);
    fireEvent.click(document.querySelector('.sheet-backdrop')!);
  }
});

test('sending: your message appears and stays; links render as plain text', () => {
  renderApp();
  goTo('Messages');
  open('Aaliyah');
  const conversation = dm()!;
  within(conversation).getByText('set times are up https://example.com/tonight');

  fireEvent.change(within(conversation).getByLabelText('Write a message'), { target: { value: '  try https://example.com/x  ' } });
  fireEvent.click(within(conversation).getByRole('button', { name: 'Send' }));
  within(conversation).getByText('try https://example.com/x');
  assert.equal((within(conversation).getByLabelText('Write a message') as HTMLInputElement).value, '');
  assert.ok(conversation.querySelector('a') === null, 'no link element anywhere in the conversation');

  fireEvent.click(button('‹ Messages'));
  screen.getByText('You: try https://example.com/x');
  open('Aaliyah');
  within(dm()!).getByText('try https://example.com/x');
});

test("the header is the person: a Suite member's presence is masked outside it, shown inside", () => {
  for (const viewer of [MOCK_VIEWERS.over21WithSuitePass, MOCK_VIEWERS.under21WithSuitePass]) {
    renderApp({ viewer });
    goTo('Messages');
    open('Dev');
    const header = person('Dev')!;
    within(header).getByText('In The Dorm');
    assert.doesNotMatch(dm()!.textContent!, /Suite|21/, viewer.profile.displayName);
    cleanup();
  }

  renderApp();
  fireEvent.click(button(/^The Suite/));
  fireEvent.click(person('Dev')!);
  sheetButton('Message');
  within(person('Dev')!).getByText('The Suite');
});

test('block from the conversation: it closes and the thread is gone; Undo brings it back with its history', () => {
  renderApp();
  goTo('Messages');
  open('Aaliyah');
  fireEvent.click(person('Aaliyah')!); // the header
  sheetButton('Block');

  assert.ok(dm() === null, 'conversation closed');
  assert.ok(row('Aaliyah') === null, 'thread gone');
  assert.ok(person('Aaliyah') === null);
  assert.match(screen.getByRole('status').textContent!, /Blocked Aaliyah\./);

  fireEvent.click(button('Undo'));
  const conversation = dm()!;
  for (const line of ['which room are you starting in', 'set times are up https://example.com/tonight', 'you on the floor yet?']) {
    within(conversation).getByText(line);
  }
  fireEvent.click(button('‹ Messages'));
  assert.ok(row('Aaliyah') !== null);
});

test('mute from the conversation hides their messages, keeps yours', () => {
  renderApp();
  goTo('Messages');
  open('Aaliyah');
  fireEvent.click(person('Aaliyah')!);
  sheetButton('Mute');
  fireEvent.click(document.querySelector('.sheet-backdrop')!);

  const conversation = dm()!;
  assert.ok(within(conversation).queryByText('you on the floor yet?') === null);
  within(conversation).getByText('which room are you starting in');
  within(conversation).getByText('Muted. Their messages are hidden.');
});

test("a blocked or muted member's unread doesn't light the tab", () => {
  for (const action of ['Block', 'Mute'] as const) {
    renderApp();
    goTo('People');
    fireEvent.click(person('Aaliyah')!);
    sheetButton(action);
    fireEvent.click(document.querySelector('.sheet-backdrop') ?? document.body);
    assert.equal(tabDot(), false, action);
    cleanup();
  }
});

test('timestamps are grouped: one stamp per group, never one per bubble', () => {
  renderApp();
  goTo('Messages');
  open('Dev');
  const conversation = dm()!;
  const stamps = [...conversation.querySelectorAll('.dm-stamp')].map((s) => s.textContent);
  const ago = (minutes: number) => TEST_TIMES.live - minutes * 60_000;
  // Nine days back (two messages, 25 minutes apart, one group), two days back, tonight.
  assert.deepEqual(stamps, [`Oct 6, ${formatTime(ago(9 * 1440))}`, `Tuesday ${formatTime(ago(2 * 1440))}`, formatTime(ago(40))]);
  assert.equal(conversation.querySelectorAll('.bubble').length, 4);
});

test('Escape closes the conversation', () => {
  renderApp();
  goTo('Messages');
  open('Dev');
  fireEvent.keyDown(window, { key: 'Escape' });
  assert.ok(dm() === null);
  assert.ok(nav() !== null);
});

// The dev panel's "Receive a message" stands in for the server. It has no
// rules of its own: whether a message lands is dmReceived's call.

test('dev: Receive a message delivers from a connection and lights the dot', async () => {
  renderDev();
  await screen.findByRole('navigation', { name: 'Main' });
  goTo('Messages');
  open('Aaliyah');
  fireEvent.click(button('‹ Messages'));
  assert.equal(tabDot(), false);

  fireEvent.click(button('DEV'));
  fireEvent.click(button('Receive a message'));
  screen.getByText('Delivered');
  screen.getByText(MOCK_DM_INCOMING[0]);
  assert.ok(row('Aaliyah, unread') !== null);
  assert.equal(tabDot(), true);
});

test("dev: a blocked sender's message is dropped, and Undo doesn't deliver it later", async () => {
  renderDev();
  await screen.findByRole('navigation', { name: 'Main' });
  goTo('People');
  fireEvent.click(person('Aaliyah')!);
  sheetButton('Block');

  fireEvent.click(button('DEV'));
  fireEvent.click(button('Receive a message'));
  screen.getByText('Dropped: blocked or not connected');

  fireEvent.click(button('Undo'));
  goTo('Messages');
  open('Aaliyah');
  assert.ok(!dm()!.textContent!.includes(MOCK_DM_INCOMING[0]));
});
