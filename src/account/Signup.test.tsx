// @vitest-environment jsdom
// Arrival and signup, end to end on the mock server. Each fireEvent is a tap
// or an entry; every server answer is awaited the way the app awaits it.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import assert from 'node:assert/strict';
import { afterEach, test } from 'vitest';

import { TEST_TIMES } from '../data/mock.ts';
import { DevRoot } from '../dev/DevRoot.tsx';
import { birthday } from '../testing/memoryStorage.ts';
import { renderAccount } from '../testing/renderAccount.tsx';
import { goTo } from '../testing/renderApp.tsx';
import { SESSION_KEY } from './service.ts';
import { NOT_EDU } from './signup.ts';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

type App = ReturnType<typeof renderAccount>;
const NOW = TEST_TIMES.live;
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const tap = (name: string | RegExp) => fireEvent.click(button(name));
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const heading = () => screen.queryByRole('heading', { level: 1 })?.textContent ?? null;
const step = (name: string) => screen.findByRole('heading', { level: 1, name });
const inVenue = () => screen.findByRole('navigation', { name: 'Main' });

async function sendEmail(email: string, via: 'Get on the list' | 'Sign in' = 'Get on the list') {
  tap(via);
  type('School email', email);
  tap('Send code');
  await step('Check your email');
}
async function enterCode(app: App, code = app.service.latestCode()!.code) {
  type('6-digit code', code);
  tap('Continue');
}
async function toDob(app: App, email = 'new@howard.edu') {
  await sendEmail(email);
  await enterCode(app);
  await step('Your date of birth');
}
async function sendDob(dob: string) {
  type('Date of birth', dob);
  tap('Continue');
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: "Yes, that's right" }));
}
async function join(app: App, { email = 'new@howard.edu', dob = birthday(NOW, 22), name = 'Marisol' } = {}) {
  await toDob(app, email);
  await sendDob(dob);
  await step('Your profile');
  type('Display name', name);
  tap('Continue');
  await step('Community guidelines');
  tap('I agree');
  await inVenue();
}

test('a first visit opens on arrival: the logo, Get on the list, Sign in', () => {
  renderAccount();
  screen.getByRole('img', { name: 'The Dorm' });
  button('Get on the list');
  button('Sign in');
  assert.ok(screen.queryByRole('navigation', { name: 'Main' }) === null);
});

test("joining: .edu email, code, date of birth, profile, guidelines, then tonight's Home", async () => {
  const app = renderAccount();
  await toDob(app, 'marisol@cs.ucla.edu');
  screen.getByText('Step 2 of 4');
  await sendDob(birthday(NOW, 22));
  await step('Your profile');
  assert.equal((screen.getByLabelText('Campus') as HTMLInputElement).value, 'UCLA', 'suggested from the email, subdomain and all');
  type('Display name', '  Marisol ');
  tap('Continue');

  await step('Community guidelines');
  const text = document.body.textContent!;
  for (const line of ['Passes are personal.', 'No selling or spam.', 'Look out for each other.', 'Report what']) assert.ok(text.includes(line), line);
  screen.getByText(/isn't affiliated with, endorsed by or sponsored by any college or university/);
  tap('Terms');
  within(screen.getByRole('dialog', { name: 'Terms of Service' })).getByText(/Placeholder/);
  tap('Close');
  tap('Privacy Policy');
  within(screen.getByRole('dialog', { name: 'Privacy Policy' })).getByText(/Placeholder/);
  tap('Close');

  tap('I agree');
  await inVenue();
  assert.equal(heading(), 'Main Floor', "tonight's Home");
  goTo('Me');
  assert.match(document.querySelector('.self-card')!.textContent!, /Marisol.*UCLA.*Verified student/);
  goTo('Messages');
  screen.getByText('No messages yet. Connect with someone to start talking.');

  app.reload();
  await inVenue();
  goTo('Me');
  assert.match(document.querySelector('.self-card')!.textContent!, /Marisol/, 'still signed in after a reload');
});

test('a non-.edu email is refused with a clear message, and no code is sent', async () => {
  const app = renderAccount();
  tap('Get on the list');
  for (const email of ['me@gmail.com', 'me@school.edu.au', 'me@school.edu.evil.com', 'me@edu']) {
    type('School email', email);
    tap('Send code');
    assert.equal(screen.getByRole('alert').textContent, NOT_EDU, email);
  }
  assert.equal(heading(), 'Get on the list');
  assert.equal(app.service.latestCode(), null);
});

test('no date of birth without the code: a wrong code is refused, a new one works', async () => {
  const app = renderAccount();
  await sendEmail('new@howard.edu');
  assert.ok(screen.queryByLabelText('Date of birth') === null, 'the code step comes first');
  const right = app.service.latestCode()!.code;
  await enterCode(app, right === '123456' ? '654321' : '123456');
  await screen.findByText("That code doesn't match. Check your email or send a new one.");
  assert.equal(heading(), 'Check your email');
  assert.ok(screen.queryByLabelText('Date of birth') === null);

  tap('Send a new code');
  await screen.findByText('New code sent.');
  await enterCode(app);
  await step('Your date of birth');
});

test('the date of birth is confirmed, sent once, then gone: not in state, on screen, on the device or in the session', async () => {
  const app = renderAccount();
  await toDob(app);
  const dob = birthday(NOW, 20, 37);
  const [y, m, d] = dob.split('-').map(Number);
  const born = new Date(y, m - 1, d);

  type('Date of birth', dob);
  tap('Continue');
  const sheet = screen.getByRole('dialog');
  within(sheet).getByText("Is that right? You can't change it later.");
  fireEvent.click(within(sheet).getByRole('button', { name: 'Edit' }));
  assert.ok(screen.queryByRole('dialog') === null, 'Edit goes back to the field');
  tap('Continue');
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: "Yes, that's right" }));
  await step('Your profile');

  const traces = [dob, `${m}/${d}/${y}`, born.toLocaleDateString([], { month: 'long', day: 'numeric' }), String(born.getTime())];
  const look = (where: Record<string, string>) => {
    for (const [place, text] of Object.entries(where)) for (const t of traces) assert.ok(!text.includes(t), `"${t}" found in ${place}`);
  };
  look({
    'signup state': JSON.stringify(app.seen.signup),
    'device storage': app.storage.dump(),
    screen: document.body.innerHTML,
    inputs: [...document.querySelectorAll('input')].map((i) => i.value).join('|'),
  });
  assert.deepEqual(app.seen.signup!.eligibility, { is18: true, is21: false });

  type('Display name', 'Marisol');
  tap('Continue');
  await step('Community guidelines');
  tap('I agree');
  await inVenue();
  look({ session: JSON.stringify(app.seen.session), 'device storage': app.storage.dump() });
});

test('under 18: a kind, plain no, and the email stays refused (a flag, never a date)', async () => {
  const app = renderAccount();
  await toDob(app, 'young@howard.edu');
  await sendDob(birthday(NOW, 18, 1)); // 18 tomorrow
  await step('Not yet');
  screen.getByText(/college students 18 and older, so we can't create your account yet\. We'd love to see you then\./);
  assert.ok(screen.queryByLabelText('Display name') === null);
  tap('Back to the start');

  app.reload();
  await sendEmail('young@howard.edu');
  await enterCode(app);
  await step('Not yet');
  assert.ok(screen.queryByLabelText('Date of birth') === null, 'never asked again');
  assert.doesNotMatch(app.storage.dump(), /\d{4}-\d{2}-\d{2}/);
  tap('Back to the start');

  await toDob(app, 'adult@howard.edu');
  await sendDob(birthday(NOW, 18)); // 18 today
  await step('Your profile');
});

test('a member who turns 21 tomorrow is not 21+: The Suite shows its lock', async () => {
  const app = renderAccount();
  await join(app, { dob: birthday(NOW, 21, 1) });
  assert.equal(button(/^The Suite/).textContent, '🔒︎The Suite · 21+');
  assert.deepEqual(app.seen.session!.viewer.eligibility, { is18: true, is21: false });
  cleanup();

  const birthdayToday = renderAccount();
  await join(birthdayToday, { email: 'other@howard.edu', dob: birthday(NOW, 21) });
  assert.doesNotMatch(button(/^The Suite/).textContent!, /21/, '21 today: no lock (a pass is the barrier now)');
});

test('profile: name 2–24 characters, campus required, a photo or the initial', async () => {
  const app = renderAccount();
  await toDob(app);
  await sendDob(birthday(NOW, 25));
  await step('Your profile');

  for (const [name, error] of [['M', 'Use at least 2 characters.'], ['x'.repeat(25), 'Keep it to 24 characters or fewer.']]) {
    type('Display name', name);
    tap('Continue');
    assert.equal(screen.getByRole('alert').textContent, error);
  }
  type('Display name', 'x'.repeat(24));
  type('Campus', ' ');
  tap('Continue');
  assert.equal(screen.getByRole('alert').textContent, 'Add your campus.');
  assert.equal(heading(), 'Your profile');

  const pick = () => screen.getByLabelText(/Add a photo|Change photo/);
  fireEvent.change(pick(), { target: { files: [new File(['notes'], 'notes.txt', { type: 'text/plain' })] } });
  await screen.findByText('Choose a photo: JPEG, PNG, WebP or HEIC.');
  fireEvent.change(pick(), { target: { files: [new File(['png'], 'me.png', { type: 'image/png' })] } });
  await waitFor(() => assert.ok(document.querySelector('.photo-row img.avatar--photo') !== null));
  tap('Use my initial');
  assert.ok(document.querySelector('.photo-row img') === null);
  fireEvent.change(pick(), { target: { files: [new File(['png'], 'me.png', { type: 'image/png' })] } });
  await waitFor(() => assert.ok(document.querySelector('.photo-row img.avatar--photo') !== null));

  type('Display name', 'Marisol');
  type('Campus', 'Howard');
  tap('Continue');
  await step('Community guidelines');
  tap('I agree');
  await inVenue();
  goTo('Me');
  assert.match(document.querySelector('.self-card img')!.getAttribute('src')!, /^data:image\/png/, 'the photo is their avatar');
});

test('Sign in: a returning member goes straight in; a new email carries on to signup', async () => {
  renderAccount();
  tap('Sign in');
  assert.equal(heading(), 'Welcome back');
  tap('‹ Back');
  button('Get on the list');
  cleanup();

  const returning = renderAccount();
  await sendEmail('jordan@howard.edu', 'Sign in');
  await enterCode(returning);
  await inVenue();
  goTo('Messages');
  button('Conversation with Aaliyah, unread');
  cleanup();

  const fresh = renderAccount();
  await sendEmail('new@cs.ucla.edu', 'Sign in');
  await enterCode(fresh);
  await step('Your date of birth');
  screen.getByText('Step 2 of 4');
  cleanup();

  const viaJoin = renderAccount();
  await sendEmail('jordan@howard.edu', 'Get on the list');
  await enterCode(viaJoin);
  await inVenue();
});

test('the session survives a reload; Sign out returns to arrival and forgets it', async () => {
  const app = renderAccount();
  await sendEmail('jordan@howard.edu', 'Sign in');
  await enterCode(app);
  await inVenue();
  assert.ok(app.storage.getItem(SESSION_KEY) !== null);

  app.reload();
  await inVenue();
  goTo('Me');
  tap('Sign out');
  button('Get on the list');
  assert.equal(app.storage.getItem(SESSION_KEY), null);

  app.reload();
  button('Get on the list');
  assert.ok(screen.queryByRole('navigation', { name: 'Main' }) === null);
});

test('dev panel: shows the code the mock server "emailed"', async () => {
  render(<DevRoot />);
  fireEvent.click(button('DEV'));
  const panel = document.querySelector('.dev-panel') as HTMLElement;
  within(panel).getByText('No code sent yet');
  await sendEmail('new@howard.edu');
  await within(panel).findByText(/^Code for new@howard\.edu: \d{6}$/);
});
