import { test } from 'vitest';
import assert from 'node:assert/strict';

import { MOCK_CHAT, MOCK_CONNECTIONS, MOCK_INVITES, MOCK_MEMBERS, MOCK_PRESENCE, MOCK_THREADS, MOCK_VIEWERS, TEST_NIGHT, TEST_TIMES } from '../data/mock.ts';
import { createVenueState } from '../venue/machine.ts';
import {
  connectionStatus, createSocialState, socialReducer, visibleInvites, visibleMembers, visibleMessages,
  visibleThreads, type SocialAction, type SocialState,
} from './social.ts';

const start = () => createSocialState({ connections: MOCK_CONNECTIONS });
const run = (s: SocialState, ...actions: SocialAction[]) => actions.reduce(socialReducer, s);

/** Everywhere a member can surface today, as ids. */
function surfaces(s: SocialState) {
  const venue = createVenueState({ viewer: MOCK_VIEWERS.over21WithSuitePass, schedule: TEST_NIGHT, now: TEST_TIMES.live, presence: MOCK_PRESENCE });
  const roster = (roomId: string) => visibleMembers(s, MOCK_MEMBERS).filter((m) => venue.presence[m.id] === roomId).map((m) => m.id);
  return {
    people: visibleMembers(s, MOCK_MEMBERS).map((m) => m.id),
    barRoster: roster('bar'),
    threads: visibleThreads(s, MOCK_THREADS).map((t) => t.memberId),
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
  assert.deepEqual(visibleMessages(s, [MOCK_THREADS[0].last]), [], 'DM messages hidden too');
  assert.deepEqual(surfaces(run(s, { type: 'toggleMute', memberId: 'm-aaliyah' })), surfaces(start()), 'unmute');
});

test('connect sends a request once; report is recorded', () => {
  let s = run(start(), { type: 'connect', memberId: 'm-leo' }, { type: 'connect', memberId: 'm-leo' });
  assert.equal(connectionStatus(s, 'm-leo'), 'pending');
  s = run(s, { type: 'report', memberId: 'm-leo', at: 1 });
  assert.deepEqual(s.reports, [{ memberId: 'm-leo', at: 1 }]);
});
