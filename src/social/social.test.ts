import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  MOCK_CHAT, MOCK_CONNECTIONS, MOCK_DM_READ, MOCK_INVITES, MOCK_MEMBERS, MOCK_PRESENCE, MOCK_VIEWERS, mockDms, TEST_NIGHT, TEST_TIMES,
} from '../data/mock.ts';
import { MAX_MESSAGE_LENGTH } from '../chat/chat.ts';
import { createVenueState, venueReducer, type Viewer } from '../venue/machine.ts';
import {
  anyUnread, campusCount, canMessage, connectionStatus, conversation, createSocialState, hasUnread, roomRoster, socialReducer,
  visibleInvites, visibleMembers, visibleMessages, visibleThreads, type DirectMessage, type SocialAction, type SocialState,
} from './social.ts';

const start = () => createSocialState({ connections: MOCK_CONNECTIONS, dms: mockDms(TEST_TIMES.live), readThrough: MOCK_DM_READ });
const run = (s: SocialState, ...actions: SocialAction[]) => actions.reduce(socialReducer, s);

/** Everywhere a member can surface today, as ids. */
function surfaces(s: SocialState) {
  const venue = createVenueState({ viewer: MOCK_VIEWERS.over21WithSuitePass, schedule: TEST_NIGHT, now: TEST_TIMES.live, presence: MOCK_PRESENCE });
  const roster = (roomId: string) => visibleMembers(s, MOCK_MEMBERS).filter((m) => venue.presence[m.id] === roomId).map((m) => m.id);
  return {
    people: visibleMembers(s, MOCK_MEMBERS).map((m) => m.id),
    barRoster: roster('bar'),
    threads: visibleThreads(s).map((t) => t.memberId),
    chatAuthors: visibleMessages(s, MOCK_CHAT).map((m) => m.authorId),
    inviteSenders: visibleInvites(s, MOCK_INVITES).map((i) => i.fromId),
  };
}

const everywhere = (ids: Record<string, string[]>, id: string) =>
  Object.entries(ids).filter(([, list]) => list.includes(id)).map(([k]) => k);

test('fixtures put each test member on the surfaces we check', () => {
  const ids = surfaces(start());
  assert.deepEqual(everywhere(ids, 'm-marcus'), ['people', 'barRoster', 'chatAuthors', 'inviteSenders']);
  assert.deepEqual(everywhere(ids, 'm-aaliyah'), ['people', 'threads', 'chatAuthors']);
});

test('block hides a member from People, rooms, chat, threads and invitations', () => {
  for (const id of ['m-marcus', 'm-aaliyah']) {
    const ids = surfaces(run(start(), { type: 'block', memberId: id }));
    assert.deepEqual(everywhere(ids, id), [], id);
  }
});

test('block hides only that member', () => {
  const before = surfaces(start());
  const after = surfaces(run(start(), { type: 'block', memberId: 'm-marcus' }));
  for (const [k, list] of Object.entries(before)) {
    assert.deepEqual(after[k as keyof typeof after], list.filter((id) => id !== 'm-marcus'), k);
  }
});

test('block ends the connection; undo restores visibility and the connection', () => {
  let s = run(start(), { type: 'block', memberId: 'm-aaliyah' });
  assert.equal(connectionStatus(s, 'm-aaliyah'), 'none');
  s = run(s, { type: 'connect', memberId: 'm-aaliyah' });
  assert.equal(connectionStatus(s, 'm-aaliyah'), 'none', 'cannot reconnect to someone you blocked');
  s = run(s, { type: 'undoBlock', memberId: 'm-aaliyah' });
  assert.equal(connectionStatus(s, 'm-aaliyah'), 'connected');
  assert.deepEqual(surfaces(s), surfaces(start()));
});

test('mute hides messages from every chat but keeps the member visible', () => {
  const s = run(start(), { type: 'toggleMute', memberId: 'm-aaliyah' });
  const ids = surfaces(s);
  assert.deepEqual(everywhere(ids, 'm-aaliyah'), ['people', 'threads']);
  assert.ok(!conversation(s, 'm-aaliyah').some((m) => m.authorId === 'm-aaliyah'), 'DM messages hidden too');
  assert.deepEqual(surfaces(run(s, { type: 'toggleMute', memberId: 'm-aaliyah' })), surfaces(start()), 'unmute');
});

test('connect sends a request once; report is recorded', () => {
  let s = run(start(), { type: 'connect', memberId: 'm-leo' }, { type: 'connect', memberId: 'm-leo' });
  assert.equal(connectionStatus(s, 'm-leo'), 'pending');
  s = run(s, { type: 'report', memberId: 'm-leo', at: 1 });
  assert.deepEqual(s.reports, [{ memberId: 'm-leo', at: 1 }]);
});

const venueAt = (roomId: 'suite' | null, viewer: Viewer = MOCK_VIEWERS.over21WithSuitePass) => {
  const s = createVenueState({ viewer, schedule: TEST_NIGHT, now: TEST_TIMES.live, presence: MOCK_PRESENCE });
  return roomId ? venueReducer(s, { type: 'enter', roomId }) : s;
};
const ids = (members: { id: string }[]) => members.map((m) => m.id);

test('room roster: who is there, minus blocked; 21+ rooms stay masked from outside', () => {
  assert.deepEqual(ids(roomRoster(venueAt(null), start(), MOCK_MEMBERS, 'bar')), ['m-marcus', 'm-zoe']);
  assert.deepEqual(ids(roomRoster(venueAt(null), run(start(), { type: 'block', memberId: 'm-zoe' }), MOCK_MEMBERS, 'bar')), ['m-marcus']);
  assert.deepEqual(roomRoster(venueAt(null), start(), MOCK_MEMBERS, 'suite'), [], 'outside The Suite');
  assert.deepEqual(roomRoster(venueAt(null, MOCK_VIEWERS.under21WithSuitePass), start(), MOCK_MEMBERS, 'suite'), []);
  assert.deepEqual(ids(roomRoster(venueAt('suite'), start(), MOCK_MEMBERS, 'suite')), ['m-dev', 'm-ava'], 'inside it');
});

test('campus count: same campus, case-insensitive, blocked not counted, 0 when none', () => {
  assert.equal(campusCount(venueAt(null), start(), MOCK_MEMBERS, 'main-floor'), 3); // Howard
  assert.equal(campusCount(venueAt(null), run(start(), { type: 'block', memberId: 'm-tre' }), MOCK_MEMBERS, 'main-floor'), 2);
  const shouty = MOCK_MEMBERS.map((m) => (m.id === 'm-kofi' ? { ...m, campus: ' HOWARD ' } : m));
  assert.equal(campusCount(venueAt(null), start(), shouty, 'main-floor'), 3);
  assert.equal(campusCount(venueAt(null), start(), MOCK_MEMBERS, 'rooftop'), 0);
});

// ---- Direct messages ----------------------------------------------------

const ME = MOCK_VIEWERS.over21WithSuitePass.profile.id;
let seq = 0;
const dm = (withId: string, body: string, from: 'me' | 'them'): DirectMessage => ({
  id: `t-${++seq}`, withId, authorId: from === 'me' ? ME : withId, body, sentAt: TEST_TIMES.live,
});
const send = (withId: string, body = 'hey') => ({ type: 'sendDm', message: dm(withId, body, 'me') }) as const;
const receive = (withId: string, body = 'hey') => ({ type: 'dmReceived', message: dm(withId, body, 'them') }) as const;
const bodies = (s: SocialState, id: string) => conversation(s, id).map((m) => m.body);

test('canMessage: connections only; pending, strangers and blocked members cannot', () => {
  const s = start();
  assert.equal(canMessage(s, 'm-aaliyah'), true);
  assert.equal(canMessage(s, 'm-jade'), false, 'pending');
  assert.equal(canMessage(s, 'm-leo'), false, 'no connection');
  assert.equal(canMessage(run(s, { type: 'block', memberId: 'm-aaliyah' }), 'm-aaliyah'), false, 'blocked');
});

test('sending to a non-connection is refused by the store, not just the button', () => {
  const s = start();
  for (const id of ['m-jade', 'm-leo']) assert.equal(run(s, send(id)), s, id);
  assert.equal(run(s, send('m-aaliyah', 'hi')).dms.length, s.dms.length + 1);
});

test('send trims, refuses empty and overlong, and only as the viewer', () => {
  const s = start();
  assert.equal(run(s, send('m-aaliyah', '  on my way  ')).dms.at(-1)!.body, 'on my way');
  assert.equal(run(s, send('m-aaliyah', '   ')), s);
  assert.equal(run(s, send('m-aaliyah', 'x'.repeat(MAX_MESSAGE_LENGTH + 1))), s);
  assert.equal(run(s, { type: 'sendDm', message: dm('m-aaliyah', 'hi', 'them') }), s, 'cannot send as them');
});

test('received messages are dropped from a blocked member or a non-connection', () => {
  const s = start();
  assert.equal(run(s, receive('m-leo')), s, 'stranger');
  assert.equal(run(s, receive('m-jade')), s, 'pending');
  const blocked = run(s, { type: 'block', memberId: 'm-aaliyah' });
  assert.equal(run(blocked, receive('m-aaliyah', 'while blocked')), blocked);

  // Undo brings back the history from before the block, never what they sent during it.
  const undone = run(blocked, receive('m-aaliyah', 'while blocked'), { type: 'undoBlock', memberId: 'm-aaliyah' });
  assert.deepEqual(bodies(undone, 'm-aaliyah'), bodies(s, 'm-aaliyah'));

  const delivered = run(s, receive('m-dev', 'still up?'));
  assert.deepEqual(bodies(delivered, 'm-dev').at(-1), 'still up?');
  assert.equal(run(delivered, { type: 'dmReceived', message: delivered.dms.at(-1)! }), delivered, 'delivered once');
  assert.equal(run(s, { type: 'dmReceived', message: dm('m-dev', 'hi', 'me') }), s, 'must be from them');
});

test('threads are derived from the messages, newest first; block removes one and Undo restores it whole', () => {
  const s = start();
  assert.deepEqual(visibleThreads(s).map((t) => t.memberId), ['m-aaliyah', 'm-dev']);
  assert.deepEqual(visibleThreads(run(s, receive('m-dev'))).map((t) => t.memberId), ['m-dev', 'm-aaliyah']);

  const blocked = run(s, { type: 'block', memberId: 'm-aaliyah' });
  assert.deepEqual(visibleThreads(blocked).map((t) => t.memberId), ['m-dev']);
  assert.deepEqual(conversation(blocked, 'm-aaliyah'), [], 'your own messages to them go too');
  assert.deepEqual(visibleThreads(run(blocked, { type: 'undoBlock', memberId: 'm-aaliyah' })), visibleThreads(s));
});

test('unread: their new messages count until you open the thread; yours never do', () => {
  let s = start();
  assert.equal(hasUnread(s, 'm-aaliyah'), true);
  assert.equal(hasUnread(s, 'm-dev'), false);
  assert.equal(anyUnread(s), true);

  s = run(s, { type: 'readThread', memberId: 'm-aaliyah' });
  assert.equal(hasUnread(s, 'm-aaliyah'), false);
  assert.equal(anyUnread(s), false);

  s = run(s, send('m-dev', 'you here?'));
  assert.equal(anyUnread(s), false, 'my own message');
  s = run(s, receive('m-dev', 'yeah'));
  assert.equal(hasUnread(s, 'm-dev'), true);
  assert.deepEqual(visibleThreads(s).map((t) => [t.memberId, t.unread]), [['m-dev', true], ['m-aaliyah', false]]);
});

test("mute hides their messages and their unread, keeps yours; block clears their unread", () => {
  const s = start();
  const muted = run(s, { type: 'toggleMute', memberId: 'm-aaliyah' });
  assert.deepEqual(bodies(muted, 'm-aaliyah'), ['which room are you starting in']);
  assert.equal(anyUnread(muted), false);
  assert.equal(anyUnread(run(s, { type: 'block', memberId: 'm-aaliyah' })), false);
  assert.equal(anyUnread(run(muted, { type: 'toggleMute', memberId: 'm-aaliyah' })), true, 'unmute');
});
