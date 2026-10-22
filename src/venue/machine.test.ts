import { test } from 'vitest';
import assert from 'node:assert/strict';

import { MOCK_OCCUPANCY, MOCK_PRESENCE, MOCK_VIEWERS, TEST_NIGHT, TEST_TIMES } from '../data/mock.ts';
import { canEnter, canSeeAlcohol, createVenueState, homeRoom, isOpen, lastCall, nightOver, openLobby, opensAt, presenceOf, visibleMenu, showsHeadcount, venueReducer, type Viewer } from './machine.ts';
import { ROOMS, validateRooms, type RoomId, type RoomRecord } from './rooms.ts';
import { canPost } from '../chat/chat.ts';

const ALL_ROOMS = ROOMS.map((r) => r.id);

function stateFor(viewer: Viewer, now = TEST_TIMES.live) {
  return createVenueState({ viewer, schedule: TEST_NIGHT, now, occupancy: MOCK_OCCUPANCY });
}

function denial(viewer: Viewer, roomId: RoomId, now?: number) {
  const access = canEnter(stateFor(viewer, now), roomId);
  return access.ok ? null : { reason: access.reason, roomId: access.roomId };
}

// --- Invariants 1 & 2 ---------------------------------------------------

test('under-21 with a Suite pass is refused The Suite on age', () => {
  assert.deepEqual(denial(MOCK_VIEWERS.under21WithSuitePass, 'suite'), { reason: 'underage', roomId: 'suite' });
});

test('under-21 with a Suite pass is refused the Suite Booth, via The Suite', () => {
  assert.deepEqual(denial(MOCK_VIEWERS.under21WithSuitePass, 'suite-booth'), { reason: 'underage', roomId: 'suite-booth' });
});

test('under-21 with a pass for the booth itself is still refused', () => {
  const viewer: Viewer = {
    ...MOCK_VIEWERS.under21WithSuitePass,
    guestPasses: [
      { roomId: 'suite', expiresAt: Infinity },
      { roomId: 'suite-booth', expiresAt: Infinity },
    ],
  };
  assert.equal(denial(viewer, 'suite-booth')?.reason, 'underage');
});

test('the enter action refuses too, and the viewer does not move', () => {
  const s = venueReducer(stateFor(MOCK_VIEWERS.under21WithSuitePass), { type: 'enter', roomId: 'suite' });
  assert.equal(s.location, null);
  assert.equal(s.lastDenial?.reason, 'underage');
});

test('21+ needs a pass for The Suite; with one, Suite opens and the booth opens from inside it', () => {
  assert.deepEqual(denial(MOCK_VIEWERS.over21NoPass, 'suite'), { reason: 'needsPass', roomId: 'suite' });
  assert.deepEqual(denial(MOCK_VIEWERS.over21NoPass, 'suite-booth'), { reason: 'needsPass', roomId: 'suite' });
  assert.equal(denial(MOCK_VIEWERS.over21WithSuitePass, 'suite'), null);
  const inSuite = venueReducer(stateFor(MOCK_VIEWERS.over21WithSuitePass), { type: 'enter', roomId: 'suite' });
  assert.equal(canEnter(inSuite, 'suite-booth').ok, true);
});

test('an expired pass does not open The Suite', () => {
  const viewer: Viewer = {
    ...MOCK_VIEWERS.over21NoPass,
    guestPasses: [{ roomId: 'suite', expiresAt: TEST_TIMES.live - 1 }],
  };
  assert.equal(denial(viewer, 'suite')?.reason, 'needsPass');
});

test('under-21 can enter the open rooms, including The Bar', () => {
  for (const id of ['main-floor', 'bar', 'rooftop', 'spot'] as const) {
    assert.equal(denial(MOCK_VIEWERS.under21WithSuitePass, id), null, id);
  }
});

// --- Invariant 5 --------------------------------------------------------

test('unverified members are refused every room', () => {
  for (const id of ALL_ROOMS) {
    assert.equal(denial(MOCK_VIEWERS.unverified, id)?.reason, 'unverified', id);
  }
});

test('under-18 is refused every room even if verified', () => {
  const viewer: Viewer = { ...MOCK_VIEWERS.over21NoPass, eligibility: { is18: false, is21: false } };
  for (const id of ALL_ROOMS) assert.equal(denial(viewer, id)?.reason, 'underage', id);
});

// --- Phases -------------------------------------------------------------

test('everything is closed before doors and after close', () => {
  for (const now of [TEST_TIMES.beforeDoors, TEST_TIMES.afterClose]) {
    for (const id of ALL_ROOMS) {
      assert.equal(denial(MOCK_VIEWERS.over21WithSuitePass, id, now)?.reason, 'closed', id);
    }
  }
});

test('After Hours is closed before midnight', () => {
  assert.equal(denial(MOCK_VIEWERS.over21NoPass, 'after-hours')?.reason, 'closed');
});

test('at After Hours, only After Hours and The Suite are open', () => {
  const v = MOCK_VIEWERS.over21WithSuitePass;
  const now = TEST_TIMES.afterHours;
  const open = ALL_ROOMS.filter((id) => denial(v, id, now)?.reason !== 'closed');
  assert.deepEqual(open.sort(), ['after-hours', 'suite', 'suite-booth']);
  assert.deepEqual(denial(v, 'bar', now), { reason: 'closed', roomId: 'bar' });
});

test('midnight moves people off the Main Floor; The Suite stays', () => {
  const onFloor = venueReducer(stateFor(MOCK_VIEWERS.over21NoPass), { type: 'enter', roomId: 'bar' });
  assert.equal(onFloor.location, 'bar');
  const after = venueReducer(onFloor, { type: 'tick', now: TEST_TIMES.afterHours });
  assert.equal(after.phase, 'afterHours');
  assert.equal(after.location, null);
  assert.equal(after.lastDenial?.reason, 'closed');
  assert.equal(after.occupancy.bar, MOCK_OCCUPANCY.bar);

  const inSuite = venueReducer(stateFor(MOCK_VIEWERS.over21WithSuitePass), { type: 'enter', roomId: 'suite' });
  assert.equal(venueReducer(inSuite, { type: 'tick', now: TEST_TIMES.afterHours }).location, 'suite');
  assert.equal(venueReducer(inSuite, { type: 'tick', now: TEST_TIMES.afterClose }).location, null);
});

test('a pass that expires while inside moves the viewer out', () => {
  const viewer: Viewer = {
    ...MOCK_VIEWERS.over21NoPass,
    guestPasses: [{ roomId: 'suite', expiresAt: TEST_TIMES.live + 1000 }],
  };
  const inside = venueReducer(stateFor(viewer), { type: 'enter', roomId: 'suite' });
  assert.equal(inside.location, 'suite');
  const later = venueReducer(inside, { type: 'tick', now: TEST_TIMES.live + 2000 });
  assert.equal(later.location, null);
  assert.equal(later.lastDenial?.reason, 'needsPass');
});

test('age is reported over "closed": under-21 sees 21+ on The Suite before doors', () => {
  const v = MOCK_VIEWERS.under21WithSuitePass;
  assert.deepEqual(denial(v, 'suite', TEST_TIMES.beforeDoors), { reason: 'underage', roomId: 'suite' });
  assert.equal(denial(v, 'main-floor', TEST_TIMES.beforeDoors)?.reason, 'closed');
});

test('opensAt: next opening tonight, or null', () => {
  const v = MOCK_VIEWERS.over21NoPass;
  const before = stateFor(v, TEST_TIMES.beforeDoors);
  assert.equal(opensAt(before, 'bar'), TEST_NIGHT.opensAt);
  assert.equal(opensAt(before, 'after-hours'), TEST_NIGHT.afterHoursAt);
  const live = stateFor(v);
  assert.equal(opensAt(live, 'bar'), null, 'already open');
  assert.equal(opensAt(live, 'after-hours'), TEST_NIGHT.afterHoursAt);
  const late = stateFor(v, TEST_TIMES.afterHours);
  assert.equal(opensAt(late, 'main-floor'), null, 'closed for tonight');
  assert.equal(opensAt(stateFor(v, TEST_TIMES.afterClose), 'after-hours'), null);
});

test('headcount: shown past a pass barrier, hidden past an age barrier', () => {
  assert.equal(showsHeadcount(stateFor(MOCK_VIEWERS.over21NoPass), 'suite'), true);
  assert.equal(showsHeadcount(stateFor(MOCK_VIEWERS.unverified), 'suite'), true);
  for (const id of ['suite', 'suite-booth'] as const) {
    for (const now of Object.values(TEST_TIMES)) {
      assert.equal(showsHeadcount(stateFor(MOCK_VIEWERS.under21WithSuitePass, now), id), false, `${id} @ ${now}`);
    }
  }
  assert.equal(showsHeadcount(stateFor(MOCK_VIEWERS.under21WithSuitePass), 'bar'), true);
  assert.equal(showsHeadcount(stateFor(MOCK_VIEWERS.over21NoPass), 'after-hours'), false, 'closed');
});

// --- Capacity & movement -----------------------------------------------

test('a full room refuses entry; the viewer counts once they are in', () => {
  let s = venueReducer(stateFor(MOCK_VIEWERS.over21WithSuitePass), { type: 'enter', roomId: 'suite' });
  s = venueReducer(s, { type: 'occupancy', counts: { 'suite-booth': 8 } });
  assert.equal(canEnter(s, 'suite-booth').ok, false);

  s = venueReducer(s, { type: 'occupancy', counts: { 'suite-booth': 7 } });
  s = venueReducer(s, { type: 'enter', roomId: 'suite-booth' });
  assert.equal(s.location, 'suite-booth');
  assert.equal(s.occupancy['suite-booth'], 8);
  assert.equal(canEnter(s, 'suite-booth').ok, true, 'already inside');
});

test('moving rooms updates both headcounts', () => {
  let s = stateFor(MOCK_VIEWERS.over21NoPass);
  s = venueReducer(s, { type: 'enter', roomId: 'rooftop' });
  s = venueReducer(s, { type: 'enter', roomId: 'spot' });
  assert.equal(s.occupancy.rooftop, MOCK_OCCUPANCY.rooftop);
  assert.equal(s.occupancy.spot, MOCK_OCCUPANCY.spot! + 1);
  s = venueReducer(s, { type: 'leave' });
  assert.equal(s.location, null);
  assert.equal(s.occupancy.spot, MOCK_OCCUPANCY.spot);
});

// --- Room config self-check --------------------------------------------

const base: RoomRecord[] = ROOMS.map((r) => ({ ...r }));
const edit = (id: string, patch: Partial<RoomRecord>) =>
  base.map((r) => (r.id === id ? { ...r, ...patch } : r));

test('the shipped room config is valid', () => {
  assert.deepEqual(validateRooms(ROOMS), []);
});

test('self-check rejects The Suite below 21', () => {
  const errors = validateRooms(edit('suite', { access: { minAge: 18, entry: 'guestPass' } }));
  assert.ok(errors.some((e) => e.includes('"suite" is in The Suite but is not 21+')), errors.join('\n'));
});

test('self-check rejects a room under The Suite below 21', () => {
  const errors = validateRooms(edit('suite-booth', { access: { minAge: 18, entry: 'open' } }));
  assert.ok(errors.some((e) => e.includes('"suite-booth"')), errors.join('\n'));
});

test('self-check rejects a missing Suite', () => {
  assert.ok(validateRooms(base.filter((r) => r.id !== 'suite' && r.id !== 'suite-booth')).some((e) => e.includes('missing')));
});

test('self-check rejects an unknown parent', () => {
  assert.ok(validateRooms(edit('bar', { parent: 'basement' })).some((e) => e.includes('unknown parent "basement"')));
});

test('self-check rejects parent cycles', () => {
  const rooms = edit('main-floor', { parent: 'bar' });
  assert.ok(validateRooms(rooms).some((e) => e.includes('cycle')));
  assert.ok(validateRooms(edit('rooftop', { parent: 'rooftop' })).some((e) => e.includes('cycle')));
});

test('self-check rejects duplicate ids and a child open when its parent is not', () => {
  assert.ok(validateRooms([...base, { ...base[0] }]).some((e) => e.includes('duplicate')));
  assert.ok(validateRooms(edit('bar', { openDuring: ['live', 'afterHours'] })).some((e) => e.includes('parent "main-floor" does not')));
});

// --- Presence masking (21+ rooms reveal age) ----------------------------

function viewerAt(viewer: Viewer, roomId: RoomId | null) {
  let s = createVenueState({ viewer, schedule: TEST_NIGHT, now: TEST_TIMES.live, occupancy: {}, presence: MOCK_PRESENCE });
  if (roomId === 'suite-booth') s = venueReducer(s, { type: 'enter', roomId: 'suite' }); // the booth is reached through The Suite
  if (roomId) s = venueReducer(s, { type: 'enter', roomId });
  assert.equal(s.location, roomId);
  return s;
}

test('presence in a 21+ room is masked for anyone outside it', () => {
  for (const [viewer, at] of [
    [MOCK_VIEWERS.under21WithSuitePass, null],
    [MOCK_VIEWERS.under21WithSuitePass, 'main-floor'],
    [MOCK_VIEWERS.over21WithSuitePass, null],
    [MOCK_VIEWERS.over21WithSuitePass, 'bar'],
  ] as const) {
    const s = viewerAt(viewer, at);
    assert.deepEqual(presenceOf(s, 'm-dev'), { kind: 'masked' }, `suite, viewer at ${at}`);
    assert.deepEqual(presenceOf(s, 'm-imani'), { kind: 'masked' }, `booth, viewer at ${at}`);
  }
});

test('inside The Suite area, Suite and Booth presence is shown', () => {
  for (const at of ['suite', 'suite-booth'] as const) {
    const s = viewerAt(MOCK_VIEWERS.over21WithSuitePass, at);
    assert.deepEqual(presenceOf(s, 'm-dev'), { kind: 'room', roomId: 'suite' });
    assert.deepEqual(presenceOf(s, 'm-imani'), { kind: 'room', roomId: 'suite-booth' });
  }
});

test('presence in open rooms is shown to everyone; absent members are away', () => {
  const s = viewerAt(MOCK_VIEWERS.under21WithSuitePass, null);
  assert.deepEqual(presenceOf(s, 'm-marcus'), { kind: 'room', roomId: 'bar' });
  assert.deepEqual(presenceOf(s, 'm-aaliyah'), { kind: 'room', roomId: 'main-floor' });
  assert.deepEqual(presenceOf(s, 'm-leo'), { kind: 'away' });
  assert.deepEqual(presenceOf(s, 'nobody'), { kind: 'away' });
});

// --- Home scene + hotspots ------------------------------------------------


test('homeRoom: where you are, else the open lobby (Main Floor, then After Hours), else none', () => {
  const v = MOCK_VIEWERS.over21WithSuitePass;
  assert.equal(homeRoom(stateFor(v)), 'main-floor');
  assert.equal(homeRoom(venueReducer(stateFor(v), { type: 'enter', roomId: 'bar' })), 'bar');
  assert.equal(homeRoom(stateFor(v, TEST_TIMES.beforeDoors)), null);
  assert.equal(homeRoom(stateFor(v, TEST_TIMES.afterHours)), 'after-hours', 'the lobby moves downstairs');
  assert.equal(homeRoom(stateFor(v, TEST_TIMES.afterClose)), null, 'the night is over');
});

test('self-check rejects a hotspot to an unknown room, to itself, or off the scene', () => {
  const withHotspot = (h: { roomId: string; x: number; y: number }) => edit('main-floor', { scene: { hotspots: [h] } });
  assert.ok(validateRooms(withHotspot({ roomId: 'cellar', x: 10, y: 10 })).some((e) => e.includes('"cellar"')));
  assert.ok(validateRooms(withHotspot({ roomId: 'main-floor', x: 10, y: 10 })).some((e) => e.includes("isn't another room")));
  assert.ok(validateRooms(withHotspot({ roomId: 'bar', x: 120, y: 10 })).some((e) => e.includes('off the scene')));
});

// --- The Suite: booth path, requests, waitlist, grants, menus -------------

const noPassUnder21: Viewer = { ...MOCK_VIEWERS.under21WithSuitePass, guestPasses: [] };
const enter = (s: ReturnType<typeof stateFor>, roomId: RoomId) => venueReducer(s, { type: 'enter', roomId });

test('the Suite Booth is reached only from inside The Suite', () => {
  const v = MOCK_VIEWERS.over21WithSuitePass;
  assert.deepEqual(denial(v, 'suite-booth'), { reason: 'throughParent', roomId: 'suite-booth' });
  assert.equal(enter(enter(stateFor(v), 'main-floor'), 'suite-booth').location, 'main-floor', 'not from Main Floor');
  const booth = enter(enter(stateFor(v), 'suite'), 'suite-booth');
  assert.equal(booth.location, 'suite-booth');
  assert.equal(venueReducer(booth, { type: 'tick', now: TEST_TIMES.live + 60_000 }).location, 'suite-booth', 'staying is fine');
  assert.equal(enter(booth, 'suite').location, 'suite', 'back out to The Suite');
});

test('the booth path never outranks age or the pass', () => {
  assert.equal(denial(MOCK_VIEWERS.under21WithSuitePass, 'suite-booth')?.reason, 'underage');
  assert.deepEqual(denial(MOCK_VIEWERS.over21NoPass, 'suite-booth'), { reason: 'needsPass', roomId: 'suite' });
});

test('request a pass: only 21+ members who lack one; never under 21, even by direct dispatch', () => {
  const ask = (v: Viewer, roomId: RoomId = 'suite') => venueReducer(stateFor(v), { type: 'requestPass', roomId }).requests.passRequested;
  assert.deepEqual(ask(MOCK_VIEWERS.over21NoPass), ['suite']);
  assert.deepEqual(ask(noPassUnder21), [], 'under 21');
  assert.deepEqual(ask(MOCK_VIEWERS.under21WithSuitePass), [], 'under 21 holding a pass');
  assert.deepEqual(ask(MOCK_VIEWERS.over21WithSuitePass), [], 'already has one');
  assert.deepEqual(ask(MOCK_VIEWERS.unverified), [], 'unverified');
  assert.deepEqual(ask(MOCK_VIEWERS.over21NoPass, 'suite-booth'), [], 'the pass is for The Suite, not the booth');
  const twice = venueReducer(venueReducer(stateFor(MOCK_VIEWERS.over21NoPass), { type: 'requestPass', roomId: 'suite' }), { type: 'requestPass', roomId: 'suite' });
  assert.deepEqual(twice.requests.passRequested, ['suite']);
});

test('waitlist: without a pass, or with one when full; never under 21', () => {
  const wait = (v: Viewer, counts = {}) =>
    venueReducer(venueReducer(stateFor(v), { type: 'occupancy', counts }), { type: 'joinWaitlist', roomId: 'suite' }).requests.waitlisted;
  assert.deepEqual(wait(MOCK_VIEWERS.over21NoPass), ['suite']);
  assert.deepEqual(wait(MOCK_VIEWERS.over21WithSuitePass), [], 'can walk in');
  assert.deepEqual(wait(MOCK_VIEWERS.over21WithSuitePass, { suite: 40 }), ['suite'], 'full');
  assert.deepEqual(wait(noPassUnder21), []);
  assert.deepEqual(wait(noPassUnder21, { suite: 40 }), []);
});

test('passGranted re-checks 21+ itself: a grant never reaches an under-21 member', () => {
  const pass = { roomId: 'suite' as const, expiresAt: TEST_NIGHT.closesAt };
  let s = venueReducer(stateFor(MOCK_VIEWERS.over21NoPass), { type: 'requestPass', roomId: 'suite' });
  s = venueReducer(s, { type: 'passGranted', pass });
  assert.equal(canEnter(s, 'suite').ok, true);
  assert.deepEqual(s.requests.passRequested, [], 'request fulfilled');

  const u = venueReducer(stateFor(noPassUnder21), { type: 'passGranted', pass });
  assert.deepEqual(u.viewer.guestPasses, [], 'no pass added');
  assert.equal(denial(noPassUnder21, 'suite')?.reason, 'underage');
  assert.equal(venueReducer(stateFor(noPassUnder21), { type: 'passGranted', pass: { ...pass, roomId: 'suite-booth' } }).viewer.guestPasses.length, 0);
});

test('canSeeAlcohol: menus show alcohol items only to 21+; zero-proof to everyone', () => {
  const menus = {
    bar: [
      { id: 'z', name: 'Zero', detail: '', alcohol: false },
      { id: 'a', name: 'Proof', detail: '', alcohol: true },
    ],
  };
  const at = (v: Viewer) => createVenueState({ viewer: v, schedule: TEST_NIGHT, now: TEST_TIMES.live, menus });
  assert.equal(canSeeAlcohol(at(MOCK_VIEWERS.under21WithSuitePass)), false);
  assert.deepEqual(visibleMenu(at(MOCK_VIEWERS.under21WithSuitePass), 'bar').map((i) => i.id), ['z']);
  assert.deepEqual(visibleMenu(at(MOCK_VIEWERS.over21NoPass), 'bar').map((i) => i.id), ['z', 'a']);
  assert.deepEqual(visibleMenu(at(MOCK_VIEWERS.over21NoPass), 'rooftop'), []);
});

test('self-check rejects "reached from parent" on a room without one', () => {
  const errors = validateRooms(edit('rooftop', { access: { minAge: 18, entry: 'open', reachedFrom: 'parent' } }));
  assert.ok(errors.some((e) => e.includes('"rooftop" is reached from its parent but has none')));
});

// --- After Hours: closing, the move downstairs, last call, reminders, end --

const viewerIn = (v: Viewer, roomId: RoomId | null) => {
  let s = stateFor(v);
  if (roomId === 'suite-booth') s = enter(s, 'suite');
  if (roomId) s = enter(s, roomId);
  assert.equal(s.location, roomId);
  return s;
};
const at = (s: ReturnType<typeof stateFor>, now: number) => venueReducer(s, { type: 'tick', now });

test('at After Hours the main rooms close; The Suite and its booth stay open', () => {
  const s = at(stateFor(MOCK_VIEWERS.over21WithSuitePass), TEST_TIMES.afterHours);
  for (const id of ['main-floor', 'bar', 'rooftop', 'spot'] as const) assert.equal(isOpen(s, id), false, id);
  for (const id of ['after-hours', 'suite', 'suite-booth'] as const) assert.equal(isOpen(s, id), true, id);
});

test('the Head downstairs prompt goes only to people moved out of a closing room', () => {
  const v = MOCK_VIEWERS.over21WithSuitePass;
  for (const id of ['main-floor', 'bar', 'rooftop', 'spot'] as const) {
    const s = at(viewerIn(v, id), TEST_TIMES.afterHours);
    assert.equal(s.location, null, id);
    assert.equal(s.closedOn, id, id);
    assert.equal(homeRoom(s), id, 'Home keeps your room on screen, closed');
  }
  for (const id of ['suite', 'suite-booth'] as const) {
    const s = at(viewerIn(v, id), TEST_TIMES.afterHours);
    assert.equal(s.location, id);
    assert.equal(s.closedOn, null, `${id}: no prompt`);
  }
  const nowhere = at(viewerIn(v, null), TEST_TIMES.afterHours);
  assert.equal(nowhere.closedOn, null, 'no room: no prompt');
  assert.equal(homeRoom(nowhere), 'after-hours', 'Home shows After Hours');
});

test('Head downstairs walks you into After Hours and clears the prompt', () => {
  const closed = at(viewerIn(MOCK_VIEWERS.under21WithSuitePass, 'bar'), TEST_TIMES.afterHours);
  assert.equal(openLobby(closed), 'after-hours');
  const down = enter(closed, 'after-hours');
  assert.equal(down.location, 'after-hours');
  assert.equal(down.closedOn, null);
});

test('posting is refused in a closed room, even for someone still marked inside', () => {
  const inside = viewerIn(MOCK_VIEWERS.over21NoPass, 'main-floor');
  assert.equal(canPost(inside, 'main-floor'), true);
  assert.equal(canPost(at(inside, TEST_TIMES.afterHours), 'main-floor'), false);
  const stale = { ...inside, now: TEST_TIMES.afterHours, phase: 'afterHours' as const };
  assert.equal(canPost(stale, 'main-floor'), false, 'the room being closed is enough');
});

test('last call: in a closing room from lastCallAt, never in The Suite or in no room', () => {
  const v = MOCK_VIEWERS.over21WithSuitePass;
  const during = TEST_NIGHT.lastCallAt + 60_000;
  assert.deepEqual(lastCall(at(viewerIn(v, 'main-floor'), during)), { at: TEST_NIGHT.afterHoursAt, to: 'after-hours' });
  assert.deepEqual(lastCall(at(viewerIn(v, 'bar'), during))?.to, 'after-hours');
  assert.equal(lastCall(at(viewerIn(v, 'main-floor'), TEST_NIGHT.lastCallAt - 60_000)), null, 'too early');
  assert.equal(lastCall(at(viewerIn(v, 'suite'), during)), null, 'The Suite stays open');
  assert.equal(lastCall(at(viewerIn(v, 'suite-booth'), during)), null);
  assert.equal(lastCall(at(viewerIn(v, null), during)), null);
});

test('reminders: set for a room that opens later, fired as a notice when it opens, cleared by going in', () => {
  let s = venueReducer(stateFor(MOCK_VIEWERS.over21NoPass), { type: 'remind', roomId: 'after-hours' });
  assert.deepEqual(s.reminders, ['after-hours']);
  s = at(s, TEST_TIMES.afterHours);
  assert.deepEqual(s.reminders, []);
  assert.deepEqual(s.notices.map((n) => n.roomId), ['after-hours']);
  assert.deepEqual(enter(s, 'after-hours').notices, []);
  const off = venueReducer(venueReducer(stateFor(MOCK_VIEWERS.over21NoPass), { type: 'remind', roomId: 'after-hours' }), { type: 'remind', roomId: 'after-hours' });
  assert.deepEqual(off.reminders, [], 'toggles off');
});

test('reminders are refused for open rooms and for rooms your age keeps you out of', () => {
  const remind = (v: Viewer, roomId: RoomId, now?: number) => venueReducer(stateFor(v, now), { type: 'remind', roomId }).reminders;
  assert.deepEqual(remind(MOCK_VIEWERS.over21NoPass, 'main-floor'), [], 'already open');
  assert.deepEqual(remind(MOCK_VIEWERS.over21NoPass, 'main-floor', TEST_TIMES.beforeDoors), ['main-floor'], 'before doors');
  assert.deepEqual(remind(MOCK_VIEWERS.under21WithSuitePass, 'suite', TEST_TIMES.beforeDoors), [], 'under 21');
  assert.deepEqual(remind(MOCK_VIEWERS.under21WithSuitePass, 'after-hours'), ['after-hours'], 'After Hours is 18+');
});

test('end of night: everything closes, nothing to look back at, Home has no room', () => {
  const s = at(at(viewerIn(MOCK_VIEWERS.over21WithSuitePass, 'main-floor'), TEST_TIMES.afterHours), TEST_TIMES.afterClose);
  assert.equal(nightOver(s), true);
  assert.equal(s.closedOn, null);
  assert.equal(homeRoom(s), null);
  const suite = at(viewerIn(MOCK_VIEWERS.over21WithSuitePass, 'suite'), TEST_TIMES.afterClose);
  assert.equal(suite.location, null, 'The Suite closes too');
  assert.equal(suite.closedOn, null);
});

test('self-check: lobbies are top-level 18+ open rooms, and there is at least one', () => {
  assert.ok(validateRooms(edit('suite', { lobby: 'Walk in' })).some((e) => e.includes('"suite" is a lobby')));
  assert.ok(validateRooms(base.map((r) => ({ ...r, lobby: undefined }))).some((e) => e.includes('no lobby')));
});
