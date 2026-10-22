import { test } from 'vitest';
import assert from 'node:assert/strict';

import { MOCK_VIEWERS, TEST_NIGHT, TEST_TIMES } from '../data/mock.ts';
import { createVenueState, venueReducer } from '../venue/machine.ts';
import { canPost, chatReducer, MAX_MESSAGE_LENGTH, roomMessages, type ChatMessage } from './chat.ts';

const msg = (body: string, roomId: ChatMessage['roomId'] = 'bar'): ChatMessage => ({ id: body, roomId, authorId: 'v-jordan', body, sentAt: 0 });
const send = (body: string, roomId?: ChatMessage['roomId']) => chatReducer({ messages: [] }, { type: 'send', message: msg(body, roomId) });

test('you can post only in the room you are in', () => {
  const s = createVenueState({ viewer: MOCK_VIEWERS.over21WithSuitePass, schedule: TEST_NIGHT, now: TEST_TIMES.live });
  assert.equal(canPost(s, 'main-floor'), false, 'looking at Main Floor is not being in it');
  const inside = venueReducer(s, { type: 'enter', roomId: 'main-floor' });
  assert.equal(canPost(inside, 'main-floor'), true);
  assert.equal(canPost(inside, 'bar'), false);
});

test('messages are trimmed; blank or overlong ones are dropped', () => {
  assert.deepEqual(send('  hi  ').messages.map((m) => m.body), ['hi']);
  assert.equal(send('   ').messages.length, 0);
  assert.equal(send('x'.repeat(MAX_MESSAGE_LENGTH)).messages.length, 1);
  assert.equal(send('x'.repeat(MAX_MESSAGE_LENGTH + 1)).messages.length, 0);
});

test('roomMessages keeps rooms apart', () => {
  const s = { messages: [msg('a', 'bar'), msg('b', 'rooftop'), msg('c', 'bar')] };
  assert.deepEqual(roomMessages(s, 'bar').map((m) => m.body), ['a', 'c']);
});
