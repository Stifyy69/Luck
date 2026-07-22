import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import CityIcon from './ui/CityIcon';

const GAME_KEY = 'luck_game_state_v1';
const GAME_SALT = 'stifyy-ogromania-salt';
const PLAYER_KEY = 'luck_player_id_v1';

function signPayload(payload: unknown) {
  const raw = JSON.stringify(payload) + GAME_SALT;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  return String(hash);
}

function loadState() {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || !parsed?.sig) return null;
    return signPayload(parsed.data) === parsed.sig ? parsed.data : null;
  } catch {
    return null;
  }
}

function saveState(data: unknown) {
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify({ data, sig: signPayload(data) }));
  } catch {}
}

type User = { id: number; username: string; email: string; playerId?: string };
type AccountHudProps = { embedded?: boolean };

export default function AccountHud({ embedded = false }: AccountHudProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadMe = async () => {
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    if (!response.ok) return;
    const payload = await response.json();
    setUser(payload.user);

    const authPlayerId = String(payload.user?.playerId || '').trim();
    if (authPlayerId) {
      localStorage.setItem(PLAYER_KEY, authPlayerId);
      window.dispatchEvent(new Event('luck-player-id-changed'));
    }

    const stateResponse = await fetch('/api/account/state', { credentials: 'include' });
    if (stateResponse.ok) {
      const statePayload = await stateResponse.json();
      const storedState = statePayload?.state && typeof statePayload.state === 'object' ? statePayload.state : {};
      const nextState = {
        ...storedState,
        playerId: String(storedState?.playerId || authPlayerId || localStorage.getItem(PLAYER_KEY) || ''),
      };
      if (!nextState.playerId) nextState.playerId = `player_${String(payload.user?.id || Date.now()).padStart(6, '0')}`;
      saveState(nextState);
      if (nextState.playerId) {
        localStorage.setItem(PLAYER_KEY, nextState.playerId);
        window.dispatchEvent(new Event('luck-player-id-changed'));
      }
      if (Object.keys(nextState).length > 0) {
        fetch('/api/account/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ state: nextState }),
        }).catch(() => {});
      }
    }
  };

  useEffect(() => {
    loadMe().catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      const state = loadState();
      if (!state) return;
      fetch('/api/account/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ state }),
      }).catch(() => {});
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [user]);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setStatus('');
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { username, password } : { username, email, password, passwordConfirm };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setStatus(String(payload?.error || 'Authentication failed.'));
        return;
      }
      await loadMe();
      setOpen(false);
      setStatus('');
      setPassword('');
      setPasswordConfirm('');
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setUser(null);
  };

  const accountControl = user ? (
    <div className={embedded
      ? 'flex shrink-0 items-center gap-2 border-l border-white/[0.08] pl-3'
      : 'flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#0b0e0c]/90 p-1.5 shadow-2xl backdrop-blur-xl'}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[10px] font-black uppercase text-[#10140b]">
          {user.username.slice(0, 2)}
        </span>
        <div className="hidden min-w-0 xl:block">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/28">Connected</p>
          <p className="max-w-[110px] truncate text-xs font-extrabold text-white">{user.username}</p>
        </div>
      </div>
      <button
        type="button"
        aria-label="Log out"
        title="Log out"
        className={embedded
          ? 'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-white/45 transition hover:bg-white/[0.06] hover:text-white'
          : 'btn-ghost rounded-xl px-3 py-2 text-[11px]'}
        onClick={logout}
      >
        {embedded ? <CityIcon name="logout" className="h-4 w-4" /> : 'Log out'}
      </button>
    </div>
  ) : (
    <button
      type="button"
      className={embedded
        ? 'shrink-0 rounded-xl border border-[rgba(211,255,81,0.22)] bg-[rgba(211,255,81,0.08)] px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.08em] text-[var(--accent)]'
        : 'btn-primary rounded-2xl px-4 py-3 text-xs'}
      onClick={() => setOpen(true)}
    >
      {embedded ? 'Save city' : 'Save your city'}
    </button>
  );

  const modal = open ? (
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" onClick={() => setOpen(false)}>
      <div className="game-panel w-full max-w-[440px] overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-white/[0.07] p-6">
          <p className="section-kicker">City account</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">{mode === 'login' ? 'Welcome back.' : 'Claim your identity.'}</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/45">Sync your progress, garage and career history across devices.</p>
        </div>
        <div className="p-6">
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.07] bg-black/25 p-1.5">
            <button type="button" className={`rounded-xl px-3 py-2.5 text-sm font-extrabold transition ${mode === 'login' ? 'bg-white/[0.09] text-white' : 'text-white/40 hover:text-white/70'}`} onClick={() => { setMode('login'); setStatus(''); }}>Log in</button>
            <button type="button" className={`rounded-xl px-3 py-2.5 text-sm font-extrabold transition ${mode === 'register' ? 'bg-white/[0.09] text-white' : 'text-white/40 hover:text-white/70'}`} onClick={() => { setMode('register'); setStatus(''); }}>Create account</button>
          </div>
          <div className="space-y-3">
            <Field label="Username"><input className="input-dark w-full rounded-2xl px-4 py-3 text-sm outline-none" placeholder="Your city name" value={username} onChange={(event) => setUsername(event.target.value)} /></Field>
            {mode === 'register' ? <Field label="Email"><input className="input-dark w-full rounded-2xl px-4 py-3 text-sm outline-none" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /></Field> : null}
            <Field label="Password"><input className="input-dark w-full rounded-2xl px-4 py-3 text-sm outline-none" type="password" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
            {mode === 'register' ? <Field label="Confirm password"><input className="input-dark w-full rounded-2xl px-4 py-3 text-sm outline-none" type="password" placeholder="••••••••" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} /></Field> : null}
          </div>
          {status ? <p className="mt-3 rounded-xl border border-red-400/20 bg-red-500/[0.07] px-3 py-2 text-sm font-semibold text-red-200">{status}</p> : null}
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost flex-1 rounded-2xl px-4 py-3 text-sm">Cancel</button>
            <button type="button" onClick={() => submit().catch(() => {})} disabled={submitting} className="btn-primary flex-[1.4] rounded-2xl px-4 py-3 text-sm disabled:opacity-50">
              {submitting ? 'Connecting...' : mode === 'login' ? 'Enter the city' : 'Create identity'}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {embedded ? accountControl : <div className="fixed right-4 top-[82px] z-[80] md:top-4">{accountControl}</div>}
      {modal ? createPortal(modal, document.body) : null}
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-white/32">{label}</span>
      {children}
    </label>
  );
}
