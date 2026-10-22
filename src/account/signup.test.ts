import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  campusError, createSignupState, nameError, isEduEmail, signupReducer, type SignupAction, type SignupState,
} from './signup.ts';

const run = (s: SignupState, ...actions: SignupAction[]) => actions.reduce(signupReducer, s);
const ADULT = { is18: true, is21: true };
const toCode = (): SignupState => run(createSignupState(), { type: 'start', intent: 'join' }, { type: 'emailSubmitted', email: 'new@howard.edu' });
const toDob = () => run(toCode(), { type: 'codeVerified', token: 'v-1', suggestedCampus: 'Howard' });
const toProfile = () => run(toDob(), { type: 'ageChecked', eligibility: ADULT });

test('.edu only: the domain must end in .edu, nothing after it', () => {
  for (const ok of ['jordan@howard.edu', '  Jordan@Howard.EDU ', 'a.b+c@cs.ucla.edu', 'x@my-school.edu']) assert.equal(isEduEmail(ok), true, ok);
  for (const bad of [
    'jordan@gmail.com', 'a@school.edu.au', 'a@school.edu.evil.com', 'a@edu', 'a@.edu', '@howard.edu', 'a@howard.edu.', 'a b@howard.edu',
    'a@-x.edu', 'a@howard.edux', 'howard.edu', 'a@howard,edu',
  ]) {
    assert.equal(isEduEmail(bad), false, bad);
  }
});

test('the steps run in order: no code step without a .edu email', () => {
  const email = run(createSignupState(), { type: 'start', intent: 'join' });
  assert.equal(email.step, 'email');
  assert.equal(run(email, { type: 'emailSubmitted', email: 'me@gmail.com' }), email);
  assert.equal(toCode().step, 'code');
  assert.equal(toCode().email, 'new@howard.edu');
});

test('no date of birth without a verified code', () => {
  const code = toCode();
  assert.equal(run(code, { type: 'ageChecked', eligibility: ADULT }), code, 'from the code step');
  const email = run(createSignupState(), { type: 'start', intent: 'join' });
  assert.equal(run(email, { type: 'codeVerified', token: 'v', suggestedCampus: '' }), email, 'a code before an email was sent');
  assert.equal(toDob().step, 'dob');
  assert.equal(toDob().token, 'v-1');
  assert.equal(toDob().profile.campus, 'Howard', 'campus suggestion carried');
});

test('under 18 is refused; 18+ moves on; only the two flags are kept', () => {
  const refused = run(toDob(), { type: 'ageChecked', eligibility: { is18: false, is21: false } });
  assert.equal(refused.step, 'refused');
  assert.equal(refused.token, null, 'the verification is spent');
  assert.equal(run(refused, { type: 'profileSubmitted', profile: { name: 'Kid', campus: 'Howard', photo: null } }), refused);

  const leaky = { is18: true, is21: false, dob: '2005-01-01' } as unknown as typeof ADULT;
  const profile = run(toDob(), { type: 'ageChecked', eligibility: leaky });
  assert.equal(profile.step, 'profile');
  assert.deepEqual(profile.eligibility, { is18: true, is21: false });
  assert.doesNotMatch(JSON.stringify(profile), /2005/);
});

test('a refusal from the server at the code step ends the flow', () => {
  assert.equal(run(toCode(), { type: 'refused' }).step, 'refused');
});

test('profile: display name 2–24 characters, campus required', () => {
  assert.equal(nameError('A'), 'Use at least 2 characters.');
  assert.equal(nameError('  A  '), 'Use at least 2 characters.', 'trimmed first');
  assert.equal(nameError('Al'), null);
  assert.equal(nameError('x'.repeat(24)), null);
  assert.equal(nameError('x'.repeat(25)), 'Keep it to 24 characters or fewer.');
  assert.equal(nameError('🔥'.repeat(24)), null, 'counted as characters, not code units');
  assert.equal(campusError('  '), 'Add your campus.');

  const p = toProfile();
  assert.equal(run(p, { type: 'profileSubmitted', profile: { name: 'x'.repeat(25), campus: 'Howard', photo: null } }), p);
  assert.equal(run(p, { type: 'profileSubmitted', profile: { name: 'Marisol', campus: ' ', photo: null } }), p);
  const agree = run(p, { type: 'profileSubmitted', profile: { name: '  Mari   Sol ', campus: ' Howard ', photo: null } });
  assert.equal(agree.step, 'agree');
  assert.deepEqual(agree.profile, { name: 'Mari Sol', campus: 'Howard', photo: null });
});

test('back: within a step, never back into the date of birth once it is sent', () => {
  assert.equal(run(toCode(), { type: 'back' }).step, 'email');
  assert.equal(run(toDob(), { type: 'back' }).step, 'arrival', 'before sending it, you can start over');
  assert.equal(run(toProfile(), { type: 'back' }).step, 'profile', 'after sending it, no way back');
  const agree = run(toProfile(), { type: 'profileSubmitted', profile: { name: 'Marisol', campus: 'Howard', photo: null } });
  assert.equal(run(agree, { type: 'back' }).step, 'profile');
});
