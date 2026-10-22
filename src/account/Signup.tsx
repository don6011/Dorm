// Arrival and signup. Each step is a screen of the signup machine (signup.ts);
// every answer comes from the account service. The date of birth exists only
// in the date field until it's sent, then nowhere in the app.

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import logo from '../../design/logo-white.webp';
import { OwnAvatar } from '../people/PersonTap.tsx';
import { useAccount } from './AccountProvider.tsx';
import { readPhoto } from './photo.ts';
import type { Session } from './service.ts';
import { campusError, emailError, NAME_MAX, NAME_MIN, nameError, NOT_EDU } from './signup.ts';

// Arrival art drops in by file name, like room art; until then, a gradient.
const ARRIVAL_ART = Object.values(
  import.meta.glob<string>('../assets/arrival.{webp,png,jpg}', { eager: true, import: 'default' }),
)[0];

const GUIDELINES = [
  ['Be kind.', 'No harassment, hate or threats.'],
  ['Respect a no.', 'If someone blocks or mutes you, let it go.'],
  ['Keep it private.', "Don't share anyone's personal info, photos or messages without their OK."],
  ['Be you.', 'One account, your own photo, no impersonation.'],
  ['Age rules are real.', '21+ rooms are for members who are 21+. Passes are personal.'],
  ['No selling or spam.', 'No promotions, links to sell things, or recruiting.'],
  ['Look out for each other.', 'If someone seems unsafe or in trouble, report it.'],
  ["Report what's wrong.", "Use Report on anyone's profile. It's reviewed privately."],
] as const;

/** Signed in: the venue, for this session. Otherwise arrival and signup. */
export function AccountGate({ children }: { children: (session: Session) => ReactNode }) {
  const { session, signup } = useAccount();
  if (session) return children(session);
  switch (signup.step) {
    case 'arrival':
      return <Arrival />;
    case 'email':
      return <EmailStep />;
    case 'code':
      return <CodeStep />;
    case 'dob':
      return <DobStep />;
    case 'refused':
      return <RefusedStep />;
    case 'profile':
      return <ProfileStep />;
    case 'agree':
      return <AgreeStep />;
  }
}

function Arrival() {
  const { dispatch } = useAccount();
  return (
    <section className="arrival" aria-label="Welcome to The Dorm">
      {ARRIVAL_ART && <img className="arrival-art" src={ARRIVAL_ART} alt="" />}
      <div className="arrival-body">
        <img className="logo" src={logo} alt="The Dorm" />
        <p className="tagline">Every campus. One night.</p>
      </div>
      <div className="arrival-actions">
        <button className="cta" onClick={() => dispatch({ type: 'start', intent: 'join' })}>
          Get on the list
        </button>
        <button className="btn arrival-signin" onClick={() => dispatch({ type: 'start', intent: 'signIn' })}>
          Sign in
        </button>
        <p className="arrival-note">Verified college students, 18 and up.</p>
      </div>
    </section>
  );
}

/** One step: Back, progress, a heading that takes focus, then the step. */
function Step({ title, step, back = false, children }: { title: string; step?: number; back?: boolean; children: ReactNode }) {
  const { dispatch } = useAccount();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="signup" aria-labelledby="signup-title">
      <div className="signup-top">
        {back && (
          <button className="back-button" onClick={() => dispatch({ type: 'back' })}>
            ‹ Back
          </button>
        )}
      </div>
      {step !== undefined && <p className="signup-progress">Step {step} of 4</p>}
      <h1 id="signup-title" className="signup-title" ref={heading} tabIndex={-1}>
        {title}
      </h1>
      {children}
    </section>
  );
}

function FieldError({ id, text }: { id: string; text: string | null | undefined }) {
  return text ? (
    <p id={id} className="field-error" role="alert">
      {text}
    </p>
  ) : null;
}

function EmailStep() {
  const { signup, dispatch, service } = useAccount();
  const [email, setEmail] = useState(signup.email);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const join = signup.intent === 'join';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = emailError(email);
    if (problem) return setError(problem);
    setBusy(true);
    const sent = await service.sendCode(email);
    setBusy(false);
    if (!sent.ok) return setError(NOT_EDU);
    dispatch({ type: 'emailSubmitted', email });
  };

  return (
    <Step title={join ? 'Get on the list' : 'Welcome back'} step={join ? 1 : undefined} back>
      <p className="signup-lede">
        {join ? 'Verified college students, 18 and up. Start with your school email.' : "Sign in with your school email. We'll send you a code."}
      </p>
      <form className="signup-form" onSubmit={submit} noValidate>
        <label htmlFor="signup-email">School email</label>
        <input
          id="signup-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          placeholder="you@school.edu"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          aria-invalid={error !== null}
          aria-describedby={error ? 'signup-email-error' : undefined}
        />
        <FieldError id="signup-email-error" text={error} />
        <button className="cta signup-cta" disabled={busy}>
          Send code
        </button>
      </form>
    </Step>
  );
}

function CodeStep() {
  const { signup, dispatch, service, signedIn } = useAccount();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const result = await service.verifyCode(signup.email, code);
    setBusy(false);
    // Whichever button brought them here: an account means they're in.
    if (result.kind === 'signedIn') return signedIn(result.session);
    if (result.kind === 'refused') return dispatch({ type: 'refused' });
    if (result.kind === 'badCode') return setError("That code doesn't match. Check your email or send a new one.");
    dispatch({ type: 'codeVerified', token: result.token, suggestedCampus: result.suggestedCampus });
  };
  const resend = async () => {
    await service.sendCode(signup.email);
    setCode('');
    setError(null);
    setNote('New code sent.');
  };

  return (
    <Step title="Check your email" step={signup.intent === 'join' ? 1 : undefined} back>
      <p className="signup-lede">
        We sent a 6-digit code to <strong>{signup.email}</strong>.
      </p>
      <form className="signup-form" onSubmit={submit} noValidate>
        <label htmlFor="signup-code">6-digit code</label>
        <input
          id="signup-code"
          className="code-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
            setError(null);
          }}
          aria-invalid={error !== null}
          aria-describedby={error ? 'signup-code-error' : undefined}
        />
        <FieldError id="signup-code-error" text={error} />
        {note && (
          <p className="field-note" role="status">
            {note}
          </p>
        )}
        <button className="cta signup-cta" disabled={busy || code.length !== 6}>
          Continue
        </button>
      </form>
      <div className="signup-links">
        <button className="link-button" onClick={resend}>
          Send a new code
        </button>
        <button className="link-button" onClick={() => dispatch({ type: 'back' })}>
          Use a different email
        </button>
      </div>
    </Step>
  );
}

function longDate(dob: string): string {
  const [y, m, d] = dob.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

function isoToday(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function DobStep() {
  const { signup, dispatch, service } = useAccount();
  // The date lives only here, in the field, until it's sent.
  const [dob, setDob] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const review = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return setError('Enter your date of birth.');
    setConfirming(true);
  };
  const send = async () => {
    const value = dob;
    setDob('');
    setConfirming(false);
    setBusy(true);
    const result = await service.checkAge(signup.token ?? '', value);
    setBusy(false);
    if ('error' in result) {
      return setError(
        result.error === 'invalidDate' ? "That date doesn't look right. Check it and try again." : 'Something went wrong. Go back and start again.',
      );
    }
    dispatch({ type: 'ageChecked', eligibility: result });
  };

  return (
    <Step title="Your date of birth" step={2} back>
      <form className="signup-form" onSubmit={review} noValidate>
        <label htmlFor="signup-dob">Date of birth</label>
        <input
          id="signup-dob"
          type="date"
          max={isoToday()}
          value={dob}
          onChange={(e) => {
            setDob(e.target.value);
            setError(null);
          }}
          aria-invalid={error !== null}
          aria-describedby={`signup-dob-note${error ? ' signup-dob-error' : ''}`}
        />
        <p id="signup-dob-note" className="field-note">
          🔒︎ Private. It's never shown to anyone and can't be changed later. If it's ever wrong, contact support.
        </p>
        <FieldError id="signup-dob-error" text={error} />
        <button className="cta signup-cta" disabled={busy}>
          Continue
        </button>
      </form>
      {confirming &&
        createPortal(
          <div className="sheet-backdrop" onClick={() => setConfirming(false)}>
            <div
              className="sheet confirm-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="dob-confirm-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sheet-grip" aria-hidden="true" />
              <h2 id="dob-confirm-title">{longDate(dob)}</h2>
              <p>Is that right? You can't change it later.</p>
              <div className="sheet-actions">
                <button className="btn btn--primary" onClick={send}>
                  Yes, that's right
                </button>
                <button className="btn" onClick={() => setConfirming(false)}>
                  Edit
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </Step>
  );
}

function RefusedStep() {
  const { dispatch } = useAccount();
  return (
    <Step title="Not yet">
      <p className="signup-lede">
        The Dorm is for college students 18 and older, so we can't create your account yet. We'd love to see you then.
      </p>
      <p className="signup-small">If you think this is wrong, contact support.</p>
      <button className="cta signup-cta" onClick={() => dispatch({ type: 'restart' })}>
        Back to the start
      </button>
    </Step>
  );
}

function ProfileStep() {
  const { signup, dispatch } = useAccount();
  const [name, setName] = useState(signup.profile.name);
  const [campus, setCampus] = useState(signup.profile.campus);
  const [photo, setPhoto] = useState<string | null>(signup.profile.photo);
  const [errors, setErrors] = useState<{ name?: string | null; campus?: string | null; photo?: string | null }>({});
  const suggested = signup.profile.campus !== '';

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const result = await readPhoto(file);
    if (result.ok) setPhoto(result.dataUrl);
    setErrors((prev) => ({ ...prev, photo: result.ok ? null : result.error }));
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = { name: nameError(name), campus: campusError(campus) };
    setErrors(next);
    if (next.name || next.campus) return;
    dispatch({ type: 'profileSubmitted', profile: { name, campus, photo } });
  };

  return (
    <Step title="Your profile" step={3}>
      <form className="signup-form" onSubmit={submit} noValidate>
        <div className="photo-row">
          <OwnAvatar name={name} photo={photo} size={72} />
          <div className="photo-actions">
            <label className="btn photo-pick">
              {photo ? 'Change photo' : 'Add a photo'}
              <input type="file" accept="image/*" className="sr-only" onChange={onFile} />
            </label>
            {photo && (
              <button type="button" className="link-button" onClick={() => setPhoto(null)}>
                Use my initial
              </button>
            )}
          </div>
        </div>
        <FieldError id="signup-photo-error" text={errors.photo} />

        <label htmlFor="signup-name">Display name</label>
        <input
          id="signup-name"
          autoComplete="nickname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={`signup-name-note${errors.name ? ' signup-name-error' : ''}`}
        />
        <p id="signup-name-note" className="field-note">
          {NAME_MIN}–{NAME_MAX} characters. It's what people see.
        </p>
        <FieldError id="signup-name-error" text={errors.name} />

        <label htmlFor="signup-campus">Campus</label>
        <input
          id="signup-campus"
          autoComplete="organization"
          placeholder="Your school"
          value={campus}
          onChange={(e) => setCampus(e.target.value)}
          aria-invalid={Boolean(errors.campus)}
          aria-describedby={`signup-campus-note${errors.campus ? ' signup-campus-error' : ''}`}
        />
        <p id="signup-campus-note" className="field-note">
          {suggested ? "Suggested from your email. Change it if it's not right." : "Your school's name."}
        </p>
        <FieldError id="signup-campus-error" text={errors.campus} />

        <button className="cta signup-cta">Continue</button>
      </form>
    </Step>
  );
}

type Legal = 'Terms of Service' | 'Privacy Policy';

function AgreeStep() {
  const { signup, service, signedIn } = useAccount();
  const [legal, setLegal] = useState<Legal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agree = async () => {
    setBusy(true);
    const result = await service.createAccount(signup.token ?? '', signup.profile, true);
    setBusy(false);
    if ('error' in result) return setError("We couldn't create your account. Go back and try again.");
    signedIn(result);
  };

  return (
    <Step title="Community guidelines" step={4} back>
      <p className="signup-lede">Everyone in The Dorm agrees to these.</p>
      <ul className="guidelines">
        {GUIDELINES.map(([title, text]) => (
          <li key={title}>
            <strong>{title}</strong> {text}
          </li>
        ))}
      </ul>
      <p className="signup-small">
        The Dorm is independent. It isn't affiliated with, endorsed by or sponsored by any college or university.
      </p>
      <p className="signup-small">
        By tapping I agree, you accept these guidelines, our{' '}
        <button className="link-button" onClick={() => setLegal('Terms of Service')}>
          Terms
        </button>{' '}
        and our{' '}
        <button className="link-button" onClick={() => setLegal('Privacy Policy')}>
          Privacy Policy
        </button>
        .
      </p>
      <FieldError id="signup-agree-error" text={error} />
      <button className="cta signup-cta" onClick={agree} disabled={busy}>
        I agree
      </button>
      {legal && <LegalSheet title={legal} onClose={() => setLegal(null)} />}
    </Step>
  );
}

/** Placeholder until the final documents are written (they're in legal review). */
function LegalSheet({ title, onClose }: { title: Legal; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet confirm-sheet" role="dialog" aria-modal="true" aria-labelledby="legal-title" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden="true" />
        <h2 id="legal-title">{title}</h2>
        <p>Placeholder. The final {title} is in legal review and will be here before launch.</p>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}
