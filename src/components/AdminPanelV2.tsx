import { type FormEvent, useEffect, useState } from 'react';

type DashboardResponse = {
  summary: {
    onlineNow: number;
    activeRecent: number;
    totalPlayers: number;
  };
  players: Array<{
    player_id: string;
    cash_available: number;
    roulette_spent: number;
    roulette_won: number;
    total_net: number;
    time_spent: number;
    leaves_collected: number;
    white_processed: number;
    blue_processed: number;
    sleep_count: number;
    sleep_money: number;
    last_seen: string;
    city: string | null;
    country: string | null;
    path: string | null;
  }>;
};

export default function AdminPanelV2() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [data, setData] = useState<DashboardResponse | null>(null);

  const loadDashboard = async () => {
    const res = await fetch('/api/adminpanelv2/dashboard', { credentials: 'include' });
    if (res.status === 401) {
      setLoggedIn(false);
      return;
    }

    const payload = await res.json();
    setData(payload);
    setLoggedIn(true);
  };

  useEffect(() => {
    loadDashboard().catch(() => {});
    const timer = window.setInterval(() => loadDashboard().catch(() => {}), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const login = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const res = await fetch('/api/adminpanelv2/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      setError('Credențiale invalide.');
      return;
    }

    await loadDashboard();
  };

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-[#0d1021] p-6 text-white">
        <div className="mx-auto mt-24 max-w-md rounded-2xl border border-white/15 bg-[#151a32]/80 p-6">
          <h1 className="text-2xl font-black">Admin Panel V2</h1>
          <form className="mt-4 space-y-3" onSubmit={login}>
            <input className="w-full rounded-lg bg-black/30 px-3 py-2" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
            <input className="w-full rounded-lg bg-black/30 px-3 py-2" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            <button className="w-full rounded-lg bg-violet-500 px-3 py-2 font-bold" type="submit">Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1021] p-6 text-white">
      <div className="mx-auto max-w-[1400px]">
        <h1 className="text-3xl font-black">Admin Panel V2</h1>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <InfoCard label="Online acum" value={String(data?.summary.onlineNow ?? 0)} />
          <InfoCard label="Activi recent" value={String(data?.summary.activeRecent ?? 0)} />
          <InfoCard label="Total jucători" value={String(data?.summary.totalPlayers ?? 0)} />
        </div>

        <div className="mt-6 overflow-auto rounded-xl border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5">
              <tr>
                {['Player', 'Cash', 'Cheltuit', 'Câștigat', 'Net', 'Timp', 'Frunze', 'Alb', 'Albastru', 'Sleep #', 'Sleep $', 'Last seen', 'Locație', 'Path'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-semibold text-white/70">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.players ?? []).map((p) => (
                <tr key={p.player_id} className="border-t border-white/10">
                  <td className="px-3 py-2">{p.player_id}</td>
                  <td className="px-3 py-2">{p.cash_available.toLocaleString('ro-RO')}</td>
                  <td className="px-3 py-2">{p.roulette_spent.toLocaleString('ro-RO')}</td>
                  <td className="px-3 py-2">{p.roulette_won.toLocaleString('ro-RO')}</td>
                  <td className="px-3 py-2">{p.total_net.toLocaleString('ro-RO')}</td>
                  <td className="px-3 py-2">{p.time_spent.toLocaleString('ro-RO')}h</td>
                  <td className="px-3 py-2">{p.leaves_collected.toLocaleString('ro-RO')}</td>
                  <td className="px-3 py-2">{p.white_processed.toLocaleString('ro-RO')}</td>
                  <td className="px-3 py-2">{p.blue_processed.toLocaleString('ro-RO')}</td>
                  <td className="px-3 py-2">{p.sleep_count}</td>
                  <td className="px-3 py-2">{p.sleep_money.toLocaleString('ro-RO')}</td>
                  <td className="px-3 py-2">{p.last_seen ? new Date(p.last_seen).toLocaleString('ro-RO') : '-'}</td>
                  <td className="px-3 py-2">{[p.city, p.country].filter(Boolean).join(', ') || '-'}</td>
                  <td className="px-3 py-2">{p.path || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/5 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-white/45">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}
