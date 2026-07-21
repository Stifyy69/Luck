import { type FormEvent, useCallback, useEffect, useState } from 'react';
import {
  adminLogin,
  adminLogout,
  fetchAdminAudit,
  fetchAdminOverview,
  fetchAdminPlayers,
  type AdminAction,
  type AdminOverviewResponse,
  type AdminPlayer,
  type AdminPlayerFilters,
  type AdminPlayersResponse,
} from '../lib/adminApi';
import AdminAudit from './admin/AdminAudit';
import AdminOverview from './admin/AdminOverview';
import AdminPlayerEditor from './admin/AdminPlayerEditor';
import AdminPlayersTable from './admin/AdminPlayersTable';
import CityIcon from './ui/CityIcon';

type AdminTab = 'overview' | 'players' | 'audit';

const DEFAULT_FILTERS: AdminPlayerFilters = {
  search: '',
  accountOnly: false,
  onlineOnly: false,
  vipOnly: false,
  gangOnly: false,
  minLevel: '',
  maxLevel: '',
  minCityXp: '',
  maxCityXp: '',
  minMoney: '',
  maxMoney: '',
  minNetWorth: '',
  maxNetWorth: '',
  minEarnings: '',
  maxEarnings: '',
  minCareer: '',
  maxCareer: '',
  minTime: '',
  maxTime: '',
  sortBy: 'lastSeenMs',
  sortDir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function AdminPanelV2() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [tab, setTab] = useState<AdminTab>('overview');
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [players, setPlayers] = useState<AdminPlayersResponse | null>(null);
  const [audit, setAudit] = useState<AdminAction[]>([]);
  const [filters, setFilters] = useState<AdminPlayerFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AdminPlayerFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminPlayer | null>(null);

  const loadOverview = useCallback(async () => {
    const payload = await fetchAdminOverview();
    setOverview(payload);
    setLoggedIn(true);
  }, []);

  const loadPlayers = useCallback(async (next = appliedFilters) => {
    const payload = await fetchAdminPlayers(next);
    setPlayers(payload);
    setLoggedIn(true);
  }, [appliedFilters]);

  const loadAudit = useCallback(async () => {
    const payload = await fetchAdminAudit();
    setAudit(payload.actions);
    setLoggedIn(true);
  }, []);

  const refreshCurrent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'overview') await loadOverview();
      else if (tab === 'players') await loadPlayers();
      else await loadAudit();
    } catch (reason: unknown) {
      const message = reason instanceof Error ? reason.message : 'Admin data failed to load.';
      if (message === 'unauthorized') setLoggedIn(false);
      else setError(message);
    } finally {
      setLoading(false);
    }
  }, [loadAudit, loadOverview, loadPlayers, tab]);

  useEffect(() => {
    refreshCurrent().catch(() => {});
  }, [refreshCurrent]);

  useEffect(() => {
    if (!loggedIn) return;
    const timer = window.setInterval(() => refreshCurrent().catch(() => {}), 30_000);
    return () => window.clearInterval(timer);
  }, [loggedIn, refreshCurrent]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setLoginError('');
    try {
      await adminLogin(username, password);
      setLoggedIn(true);
      setPassword('');
      await loadOverview();
    } catch (reason: unknown) {
      setLoginError(reason instanceof Error ? reason.message : 'Invalid credentials.');
    }
  };

  const logout = async () => {
    await adminLogout().catch(() => {});
    setLoggedIn(false);
    setOverview(null);
    setPlayers(null);
    setAudit([]);
  };

  const applyFilters = () => {
    const next = { ...filters, page: 1 };
    setAppliedFilters(next);
    setFilters(next);
  };

  const changePage = (page: number) => {
    const next = { ...appliedFilters, page };
    setAppliedFilters(next);
    setFilters(next);
  };

  if (!loggedIn) {
    return (
      <div className="min-h-screen px-4 pb-10 pt-24 text-white sm:px-6">
        <div className="mx-auto max-w-md">
          <section className="game-panel overflow-hidden">
            <div className="border-b border-white/[0.07] p-6"><p className="section-kicker">Restricted system</p><h1 className="mt-3 text-4xl font-black tracking-[-0.055em] text-white">Control Center</h1><p className="mt-3 text-sm leading-relaxed text-white/40">Manage players, economy, progression, inventory, VIP access and audit history.</p></div>
            <form className="space-y-3 p-6" onSubmit={login}>
              <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.14em] text-white/28">Username</span><input className="input-dark w-full rounded-xl px-4 py-3 text-sm outline-none" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
              <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.14em] text-white/28">Password</span><input className="input-dark w-full rounded-xl px-4 py-3 text-sm outline-none" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              {loginError ? <p className="rounded-xl border border-red-400/20 bg-red-500/[0.06] px-3 py-2 text-sm font-bold text-red-100">{loginError}</p> : null}
              <button type="submit" className="btn-primary w-full rounded-xl px-4 py-3.5 text-sm">Enter Control Center</button>
            </form>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pb-12 pt-24 sm:px-6 md:px-8">
      <div className="mx-auto max-w-[1480px] space-y-5">
        <section className="game-panel relative overflow-hidden p-5 sm:p-7">
          <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-[var(--accent)] opacity-[0.065] blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="section-kicker">CityFlow administration</p><h1 className="mt-3 text-4xl font-black tracking-[-0.055em] text-white sm:text-6xl">Control Center</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/40">Search the complete player database, filter by ranges, edit core values safely and inspect every change through the audit log.</p></div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => refreshCurrent().catch(() => {})} className="btn-secondary rounded-xl px-4 py-3 text-xs"><span className="inline-flex items-center gap-2"><CityIcon name="refresh" className="h-4 w-4" />Refresh</span></button><button type="button" onClick={logout} className="btn-ghost rounded-xl px-4 py-3 text-xs"><span className="inline-flex items-center gap-2"><CityIcon name="logout" className="h-4 w-4" />Log out</span></button></div>
          </div>
        </section>

        <section className="game-panel-soft flex flex-wrap gap-2 p-2">
          {(['overview', 'players', 'audit'] as AdminTab[]).map((entry) => <button key={entry} type="button" onClick={() => setTab(entry)} className={`rounded-[14px] px-5 py-3 text-xs font-black uppercase tracking-[0.1em] ${tab === entry ? 'bg-[var(--accent)] text-[#10140b]' : 'text-white/35 hover:bg-white/[0.04] hover:text-white/70'}`}>{entry}</button>)}
        </section>

        {error ? <section className="rounded-[18px] border border-red-400/20 bg-red-500/[0.06] p-4 text-sm font-bold text-red-100">{error}</section> : null}
        {loading && !overview && !players && audit.length === 0 ? <section className="game-panel-soft p-12 text-center text-sm font-black uppercase tracking-[0.14em] text-white/28">Loading control data...</section> : null}

        {tab === 'overview' && overview ? <AdminOverview data={overview} /> : null}
        {tab === 'players' ? <AdminPlayersTable data={players} filters={filters} loading={loading} onFiltersChange={setFilters} onApply={applyFilters} onPage={changePage} onEdit={setEditing} /> : null}
        {tab === 'audit' ? <AdminAudit actions={audit} /> : null}
      </div>

      {editing ? <AdminPlayerEditor player={editing} onClose={() => setEditing(null)} onChanged={() => { loadPlayers().catch(() => {}); loadOverview().catch(() => {}); loadAudit().catch(() => {}); }} /> : null}
    </div>
  );
}
