import assert from 'node:assert/strict';
import { test } from 'vitest';

import { birthday, memoryStorage } from '../testing/memoryStorage.ts';
import { MOCK_VIEWERS, TEST_TIMES } from './mock.ts';
import { createMockAccountService, eligibilityOn } from './mockService.ts';

const NOW = TEST_TIMES.live;
const TODAY = new Date(NOW);
const make = (storage = memoryStorage()) => ({ storage, svc: createMockAccountService({ clock: () => NOW, storage }) });

async function verified(svc: ReturnType<typeof make>['svc'], email = 'new@howard.edu') {
  await svc.sendCode(email);
  const r = await svc.verifyCode(email, svc.latestCode()!.code);
  assert.equal(r.kind, 'verified');
  return r.kind === 'verified' ? r : null!;
}

test('age flags: birthdays count from the day itself', () => {
  assert.deepEqual(eligibilityOn(birthday(NOW, 18), TODAY), { is18: true, is21: false }, '18 today');
  assert.deepEqual(eligibilityOn(birthday(NOW, 18, 1), TODAY), { is18: false, is21: false }, '18 tomorrow');
  assert.deepEqual(eligibilityOn(birthday(NOW, 21), TODAY), { is18: true, is21: true }, '21 today');
  assert.deepEqual(eligibilityOn(birthday(NOW, 21, 1), TODAY), { is18: true, is21: false }, '21 tomorrow');
  assert.deepEqual(eligibilityOn(birthday(NOW, 21, 40), TODAY), { is18: true, is21: false }, '21 next month');
  for (const bad of ['2003-02-30', '03/09/2004', '', birthday(NOW, 0, 1), '1890-01-01']) assert.equal(eligibilityOn(bad, TODAY), null, bad);
});

test('sendCode refuses anything but .edu', async () => {
  const { svc } = make();
  for (const email of ['a@gmail.com', 'a@school.edu.au', 'a@school.edu.evil.com']) {
    assert.deepEqual(await svc.sendCode(email), { ok: false, error: 'notEdu' }, email);
  }
  assert.equal(svc.latestCode(), null, 'nothing sent');
  assert.deepEqual(await svc.sendCode(' New@Howard.EDU '), { ok: true });
  assert.equal(svc.latestCode()!.email, 'new@howard.edu');
  assert.match(svc.latestCode()!.code, /^\d{6}$/);
});

test('codes: wrong is refused, right works once, a new code replaces the old', async () => {
  const { svc } = make();
  await svc.sendCode('new@howard.edu');
  const first = svc.latestCode()!.code;
  assert.deepEqual(await svc.verifyCode('new@howard.edu', first === '000000' ? '111111' : '000000'), { kind: 'badCode' });
  await svc.sendCode('new@howard.edu');
  const second = svc.latestCode()!.code;
  if (first !== second) assert.deepEqual(await svc.verifyCode('new@howard.edu', first), { kind: 'badCode' }, 'old code');
  const r = await svc.verifyCode('new@howard.edu', second);
  assert.equal(r.kind, 'verified');
  assert.deepEqual(await svc.verifyCode('new@howard.edu', second), { kind: 'badCode' }, 'used once');
  assert.deepEqual(await svc.verifyCode('nobody@howard.edu', second), { kind: 'badCode' }, 'never sent');
});

test('the campus suggestion comes from the email domain, subdomains too', async () => {
  const { svc } = make();
  assert.equal((await verified(svc, 'a@cs.ucla.edu')).suggestedCampus, 'UCLA');
  assert.equal((await verified(svc, 'a@howard.edu')).suggestedCampus, 'Howard');
  assert.equal((await verified(svc, 'a@unknown.edu')).suggestedCampus, '');
});

test('a returning member is signed in by the code alone', async () => {
  const { svc } = make();
  await svc.sendCode('Jordan@Howard.edu');
  const r = await svc.verifyCode('jordan@howard.edu', svc.latestCode()!.code);
  assert.equal(r.kind, 'signedIn');
  assert.deepEqual(r.kind === 'signedIn' && r.session.viewer, MOCK_VIEWERS.over21WithSuitePass);
});

test('checkAge: exactly two flags back, sent once, only with a verified email', async () => {
  const { svc } = make();
  assert.deepEqual(await svc.checkAge('v-made-up', birthday(NOW, 30)), { error: 'unverified' });
  const { token } = await verified(svc);
  assert.deepEqual(await svc.checkAge(token, '2003-02-30'), { error: 'invalidDate' });
  const result = await svc.checkAge(token, birthday(NOW, 21, 1));
  assert.deepEqual(Object.keys(result).sort(), ['is18', 'is21']);
  assert.deepEqual(result, { is18: true, is21: false });
  assert.deepEqual(await svc.checkAge(token, birthday(NOW, 30)), { error: 'alreadySent' }, 'no second try with an older date');
});

test('under 18: refused, remembered as a flag on the email, and never a date', async () => {
  const { svc, storage } = make();
  const dob = birthday(NOW, 18, 1);
  const { token } = await verified(svc);
  assert.deepEqual(await svc.checkAge(token, dob), { is18: false, is21: false });
  assert.deepEqual(await svc.createAccount(token, { name: 'Kid', campus: 'Howard', photo: null }, true), { error: 'unverified' });

  // A reload, the same email again: refused straight after the code.
  const again = createMockAccountService({ clock: () => NOW, storage });
  await again.sendCode('new@howard.edu');
  assert.deepEqual(await again.verifyCode('new@howard.edu', again.latestCode()!.code), { kind: 'refused' });

  const kept = JSON.parse(JSON.parse(storage.dump())[0][1]);
  assert.deepEqual(kept.refused, ['new@howard.edu']);
  assert.doesNotMatch(storage.dump(), new RegExp(`${dob}|${dob.slice(0, 4)}|\\d{4}-\\d{2}-\\d{2}`), 'no date of any kind');
});

test('createAccount: eligibility from the server, profile rules, and the session survives a reload', async () => {
  const { svc, storage } = make();
  const { token } = await verified(svc);
  assert.deepEqual(await svc.createAccount(token, { name: 'Mari', campus: 'Howard', photo: null }, true), { error: 'unverified' }, 'age first');
  await svc.checkAge(token, birthday(NOW, 20));
  assert.deepEqual(await svc.createAccount(token, { name: 'M', campus: 'Howard', photo: null }, true), { error: 'invalidProfile' });
  const session = await svc.createAccount(token, { name: ' Mari ', campus: 'Howard', photo: null }, true);
  assert.ok('viewer' in session);
  assert.deepEqual(session.viewer.eligibility, { is18: true, is21: false });
  assert.equal(session.viewer.profile.displayName, 'Mari');
  assert.equal(session.viewer.eduVerified, true);
  assert.deepEqual(session.social, { connections: {}, dms: [], readThrough: {} }, 'a new member starts with nobody');
  assert.doesNotMatch(storage.dump(), /\d{4}-\d{2}-\d{2}/, 'no date of birth kept');

  const reloaded = createMockAccountService({ clock: () => NOW, storage });
  assert.deepEqual(await reloaded.restore(session.token), session);
  await reloaded.signOut(session.token);
  assert.equal(await createMockAccountService({ clock: () => NOW, storage }).restore(session.token), null);

  // Signing in again later: straight in.
  await reloaded.sendCode('new@howard.edu');
  const back = await reloaded.verifyCode('new@howard.edu', reloaded.latestCode()!.code);
  assert.equal(back.kind === 'signedIn' && back.session.viewer.profile.displayName, 'Mari');
});
