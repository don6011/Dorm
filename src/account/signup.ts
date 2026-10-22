// Signup as a state machine, like the venue machine: screens show it, they
// never decide it. Steps run in order and none can be skipped. The date of
// birth is never held here, only the two flags the server returned for it.

import type { Eligibility } from '../venue/machine.ts';

export type SignupStep = 'arrival' | 'email' | 'code' | 'dob' | 'refused' | 'profile' | 'agree';

export interface ProfileDraft {
  name: string;
  campus: string;
  photo: string | null;
}

export interface SignupState {
  step: SignupStep;
  /**
   * Which arrival button they pressed. Only the wording changes: the flow is
   * shared, so the app never reveals whether an email has an account.
   */
  intent: 'join' | 'signIn';
  email: string;
  /** The server's proof the email is verified. Nothing past the code step happens without it. */
  token: string | null;
  eligibility: Eligibility | null;
  profile: ProfileDraft;
}

export type SignupAction =
  | { type: 'start'; intent: 'join' | 'signIn' }
  | { type: 'back' }
  | { type: 'restart' }
  | { type: 'emailSubmitted'; email: string }
  | { type: 'codeVerified'; token: string; suggestedCampus: string }
  | { type: 'refused' }
  | { type: 'ageChecked'; eligibility: Eligibility }
  | { type: 'profileSubmitted'; profile: ProfileDraft };

export const NAME_MIN = 2;
export const NAME_MAX = 24;
export const CAMPUS_MAX = 60;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// One or more domain labels, then exactly "edu" at the end: school.edu.au and
// school.edu.evil.com are not .edu addresses.
const EDU = /^[^\s@]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+edu$/;

/** Membership needs a .edu address (invariant 5). */
export function isEduEmail(email: string): boolean {
  return EDU.test(normalizeEmail(email));
}

export const NOT_EDU = 'Use your school email. It ends in .edu.';

export function emailError(email: string): string | null {
  return isEduEmail(email) ? null : NOT_EDU;
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function nameError(name: string): string | null {
  const length = [...normalizeName(name)].length;
  if (length < NAME_MIN) return `Use at least ${NAME_MIN} characters.`;
  if (length > NAME_MAX) return `Keep it to ${NAME_MAX} characters or fewer.`;
  return null;
}

export function campusError(campus: string): string | null {
  const length = [...campus.trim()].length;
  if (length === 0) return 'Add your campus.';
  if (length > CAMPUS_MAX) return `Keep it to ${CAMPUS_MAX} characters or fewer.`;
  return null;
}

export function createSignupState(): SignupState {
  return { step: 'arrival', intent: 'join', email: '', token: null, eligibility: null, profile: { name: '', campus: '', photo: null } };
}

/** Where Back goes from each step. No way back to the date of birth once it's sent. */
const BACK: Partial<Record<SignupStep, SignupStep>> = { email: 'arrival', code: 'email', dob: 'arrival', agree: 'profile' };

export function signupReducer(state: SignupState, action: SignupAction): SignupState {
  switch (action.type) {
    case 'start':
      return state.step === 'arrival' ? { ...createSignupState(), step: 'email', intent: action.intent } : state;
    case 'restart':
      return createSignupState();
    case 'back': {
      const to = BACK[state.step];
      if (!to) return state;
      // Leaving the code or date-of-birth steps drops the verification: start over.
      return to === 'arrival' ? createSignupState() : { ...state, step: to, token: to === 'email' ? null : state.token };
    }
    case 'emailSubmitted':
      if (state.step !== 'email' || !isEduEmail(action.email)) return state;
      return { ...state, step: 'code', email: normalizeEmail(action.email) };
    case 'codeVerified':
      if (state.step !== 'code') return state;
      return { ...state, step: 'dob', token: action.token, profile: { ...state.profile, campus: action.suggestedCampus } };
    case 'refused':
      if (state.step !== 'code' && state.step !== 'dob') return state;
      return { ...state, step: 'refused', token: null };
    case 'ageChecked': {
      if (state.step !== 'dob' || state.token === null) return state;
      // Keep the two flags only, whatever else a reply might carry.
      const eligibility = { is18: action.eligibility.is18, is21: action.eligibility.is21 };
      return eligibility.is18 ? { ...state, step: 'profile', eligibility } : { ...state, step: 'refused', token: null, eligibility };
    }
    case 'profileSubmitted': {
      const p = action.profile;
      if (state.step !== 'profile' || nameError(p.name) || campusError(p.campus)) return state;
      return { ...state, step: 'agree', profile: { name: normalizeName(p.name), campus: p.campus.trim(), photo: p.photo } };
    }
  }
}
