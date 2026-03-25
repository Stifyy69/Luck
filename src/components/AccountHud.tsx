import { useEffect, useState } from 'react';

const GAME_KEY = 'luck_game_state_v1';
const GAME_SALT = 'stifyy-ogromania-salt';

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

type User = { id: number; username: string; email: string };

export default function AccountHud() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [status, setStatus] = useState('');

  const loadMe = async () => {
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    if (!response.ok) return;
    const payload = await response.json();
    setUser(payload.user);

    const stateResponse = await fetch('/api/account/state', { credentials: 'include' });
    if (stateResponse.ok) {
      const statePayload = await stateResponse.json();
      if (statePayload?.state && Object.keys(statePayload.state).length > 0) {
        saveState(statePayload.state);
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
    setStatus('');
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = mode === 'login'
      ? { username, password }
      : { username, email, password, passwordConfirm };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      setStatus('A eșuat autentificarea.');
      return;
    }
    await loadMe();
    setOpen(false);
    setStatus('');
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setUser(null);
  };

  return (
    <>
      <div className="fixed right-4 top-4 z-[80] flex items-center gap-2">
        {user ? (
          <>
            <div className="hud-card px-3 py-2 text-xs font-bold text-white">{user.username}</div>
            <button type="button" className="btn-ghost rounded-lg px-3 py-2 text-xs font-bold" onClick={logout}>Logout</button>
          </>
        ) : (
          <button type="button" className="btn-primary rounded-lg px-3 py-2 text-xs font-bold" onClick={() => setOpen(true)}>Create account</button>
        )}
      </div>

      {open ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="hud-panel w-full max-w-md p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex gap-2">
              <button type="button" className={`rounded-lg px-3 py-2 text-sm font-bold ${mode === 'login' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setMode('login')}>Login</button>
              <button type="button" className={`rounded-lg px-3 py-2 text-sm font-bold ${mode === 'register' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setMode('register')}>Create account</button>
            </div>
            <input className="input-dark mb-2 w-full rounded-lg px-3 py-2 text-sm" placeholder="Cont" value={username} onChange={(e) => setUsername(e.target.value)} />
            {mode === 'register' ? <input className="input-dark mb-2 w-full rounded-lg px-3 py-2 text-sm" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} /> : null}
            <input className="input-dark mb-2 w-full rounded-lg px-3 py-2 text-sm" type="password" placeholder="Parola" value={password} onChange={(e) => setPassword(e.target.value)} />
            {mode === 'register' ? <input className="input-dark mb-2 w-full rounded-lg px-3 py-2 text-sm" type="password" placeholder="Confirmă parola" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} /> : null}
            {status ? <p className="mb-2 text-sm text-rose-300">{status}</p> : null}
            <button type="button" onClick={submit} className="btn-primary w-full rounded-lg px-3 py-2 text-sm font-bold">{mode === 'login' ? 'Login' : 'Create account'}</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
