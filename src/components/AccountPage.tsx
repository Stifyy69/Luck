import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { setPlayerId } from '../context/PlayerContext';
import { usePlayer } from '../hooks/usePlayer';
import type { SessionUser } from '../lib/api';
import CityIcon from './ui/CityIcon';

type AccountPageProps = {
  forced?: boolean;
  onNavigate: (path: string) => void;
};

type Mode = 'register' | 'login';

export default function AccountPage({ forced = false, onNavigate }: AccountPageProps) {
  const { session } = usePlayer();
  const [mode, setMode] = useState<Mode>(session?.isGuest ? 'register' : 'login');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resident = session && !session.isGuest;

  useEffect(() => {
    if (resident && forced) onNavigate('/city');
  }, [forced, onNavigate, resident]);

  useEffect(() => {
    if (session?.isGuest) setMode('register');
  }, [session?.isGuest]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    if (mode === 'login' && session?.isGuest) {
      const confirmed = window.confirm('Logging in will open your existing account. The temporary Visitor tutorial reward will not be merged into it. Continue?');
      if (!confirmed) return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login'
        ? { username, password }
        : { displayName, username, email, password, passwordConfirm };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null) as { user?: SessionUser; error?: string } | null;
      if (!response.ok || !payload?.user) throw new Error(String(payload?.error || 'Authentication failed.'));

      setPlayerId(payload.user.playerId);
      window.dispatchEvent(new Event('luck-session-changed'));
      window.location.assign('/city');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (resident) {
    return (
      <div className="min-h-screen px-4 py-20 text-white sm:px-6">
        <div className="game-panel mx-auto max-w-lg p-7 text-center">
          <p className="section-kicker">Resident account</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">ID #{session.cityId}</h1>
          <p className="mt-3 text-sm text-white/45">You are connected as {session.username}.</p>
          <button type="button" onClick={() => onNavigate('/city')} className="btn-primary mt-6 rounded-2xl px-6 py-3 text-sm">Return to city</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070a08] px-4 py-10 text-white sm:px-6 sm:py-16">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-[var(--accent)] opacity-[0.075] blur-[130px]" />
      <div className="relative mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="game-panel flex flex-col justify-between overflow-hidden p-7 sm:p-9">
          <div>
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-[20px] bg-[var(--accent)] text-lg font-black text-[#10140b]">CF</span>
            <p className="section-kicker mt-8">Visitor checkpoint</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.055em] sm:text-5xl">Keep what you earned.</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/45">Create an account to keep your tutorial reward, progress and identity. Your permanent number is assigned only after registration.</p>
          </div>

          <div className="mt-10 space-y-3">
            <Benefit icon="check" title="Visitor progress preserved" detail="Your money, XP and first delivery stay on the same profile." />
            <Benefit icon="profile" title="Permanent player identity" detail="Your account receives the next available ID # number." />
            <Benefit icon="inventory" title="Persistent city" detail="Inventory, garage and career history remain available after login." />
          </div>
        </section>

        <section className="game-panel overflow-hidden">
          <div className="border-b border-white/[0.07] p-6 sm:p-8">
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.07] bg-black/25 p-1.5">
              <button type="button" className={`rounded-xl px-3 py-3 text-sm font-extrabold transition ${mode === 'register' ? 'bg-white/[0.09] text-white' : 'text-white/40 hover:text-white/70'}`} onClick={() => { setMode('register'); setError(null); }}>Create account</button>
              <button type="button" className={`rounded-xl px-3 py-3 text-sm font-extrabold transition ${mode === 'login' ? 'bg-white/[0.09] text-white' : 'text-white/40 hover:text-white/70'}`} onClick={() => { setMode('login'); setError(null); }}>Log in</button>
            </div>
          </div>

          <form className="space-y-4 p-6 sm:p-8" onSubmit={submit}>
            <div>
              <p className="section-kicker">{mode === 'register' ? 'Claim your identity' : 'Existing resident'}</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">{mode === 'register' ? 'Create your CityFlow account.' : 'Welcome back.'}</h2>
            </div>

            {mode === 'register' ? <Field label="Display name"><input required minLength={2} data-tutorial-target="account-display-name" className="input-dark w-full rounded-2xl px-4 py-3 text-sm outline-none" value={displayName} maxLength={32} onChange={(event) => setDisplayName(event.target.value)} placeholder="Name shown in the city" /></Field> : null}
            <Field label="Username"><input required minLength={3} className="input-dark w-full rounded-2xl px-4 py-3 text-sm outline-none" value={username} maxLength={24} onChange={(event) => setUsername(event.target.value)} placeholder="Account username" autoComplete="username" /></Field>
            {mode === 'register' ? <Field label="Email"><input required className="input-dark w-full rounded-2xl px-4 py-3 text-sm outline-none" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" /></Field> : null}
            <Field label="Password"><input required minLength={10} className="input-dark w-full rounded-2xl px-4 py-3 text-sm outline-none" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 10 characters" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /></Field>
            {mode === 'register' ? <Field label="Confirm password"><input required minLength={10} className="input-dark w-full rounded-2xl px-4 py-3 text-sm outline-none" type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder="Repeat password" autoComplete="new-password" /></Field> : null}

            {mode === 'login' && session?.isGuest ? <p className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.055] px-4 py-3 text-xs leading-5 text-amber-100/70">Login opens your existing profile. The temporary Visitor reward is not merged into an existing account.</p> : null}
            {error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/[0.07] px-4 py-3 text-sm font-semibold text-red-200">{error}</p> : null}

            <button type="submit" disabled={submitting} className="btn-primary w-full rounded-2xl px-5 py-4 text-sm disabled:opacity-45">
              {submitting ? 'Connecting...' : mode === 'register' ? 'Create account and receive ID' : 'Log in to existing account'}
            </button>
            {!forced ? <button type="button" onClick={() => onNavigate('/city')} className="btn-ghost w-full rounded-2xl px-5 py-3 text-sm">Back to city</button> : null}
          </form>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-white/32">{label}</span>{children}</label>;
}

function Benefit({ icon, title, detail }: { icon: Parameters<typeof CityIcon>[0]['name']; title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[18px] border border-white/[0.07] bg-black/20 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[rgba(211,255,81,0.08)] text-[var(--accent)]"><CityIcon name={icon} className="h-4 w-4" /></span>
      <span><strong className="block text-sm text-white">{title}</strong><span className="mt-1 block text-xs leading-5 text-white/38">{detail}</span></span>
    </div>
  );
}
