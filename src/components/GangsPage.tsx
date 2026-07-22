import { useMemo, useState } from 'react';
import PageDisclaimer from './PageDisclaimer';
import GangMemberCard from './gangs/GangMemberCard';
import GangMemberFilters, { defaultMemberFilters, type MemberFilters } from './gangs/GangMemberFilters';
import GangWorkPanel from './gangs/GangWorkPanel';
import { useGangStockActions } from '../hooks/useGangStockActions';
import { filterGangMembers } from '../lib/gangMemberFilters';

export default function GangsPage() {
  const { state, loading, pending, error, refresh, sell, process } = useGangStockActions();
  const [section, setSection] = useState<'Overview' | 'Work' | 'Members' | 'Recruitment' | 'Storage' | 'Finance' | 'Battles'>('Work');
  const [filters, setFilters] = useState<MemberFilters>(defaultMemberFilters);
  const filteredMembers = useMemo(() => filterGangMembers(state.members, filters), [state.members, filters]);

  return (
    <div className="min-h-screen px-3 pb-10 pt-20 text-white sm:px-5">
      <div className="mx-auto max-w-[1460px] space-y-4">
        <header className="hud-panel p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.25em] text-amber-200/70">CityFlow No-RP</p><h1 className="text-3xl font-black">{state.name || 'Gang'}</h1><p className="text-xs text-white/45">Gang level {state.level} · State v{state.stateVersion}</p></div><button onClick={() => void refresh()} className="rounded-xl bg-white/10 px-4 py-2 text-xs font-black">Refresh server state</button></div>
          <nav className="mt-4 grid grid-cols-3 gap-2 md:grid-cols-7">{(['Overview', 'Work', 'Members', 'Recruitment', 'Storage', 'Finance', 'Battles'] as const).map((item) => <button key={item} onClick={() => setSection(item)} className={`h-10 rounded-lg text-[11px] font-black ${section === item ? 'bg-violet-500/70' : 'bg-white/5 text-white/55'}`}>{item}</button>)}</nav>
        </header>
        {error ? <div className="rounded-xl border border-rose-300/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div> : null}
        {loading ? <div className="hud-panel p-8 text-center text-white/60">Se încarcă starea gang-ului de pe server…</div> : section === 'Work' ? <GangWorkPanel state={state} pending={pending} onProcess={process} onSell={sell} /> : section === 'Members' ? <section className="space-y-3"><GangMemberFilters filters={filters} count={filteredMembers.length} onChange={setFilters} onReset={() => setFilters(defaultMemberFilters)} />{filteredMembers.length ? <div className="grid items-stretch gap-3 md:grid-cols-2 xl:grid-cols-3">{filteredMembers.map((member) => <GangMemberCard key={member.id} member={member} />)}</div> : <div className="rounded-2xl border border-white/10 bg-black/25 p-8 text-center text-sm text-white/50">No members match these filters.</div>}</section> : <Placeholder section={section} state={state} />}
        <PageDisclaimer />
      </div>
    </div>
  );
}

function Placeholder({ section, state }: { section: string; state: { cleanBalance: number; dirtyBalance: number; stockValue: number; battleReputation: number } }) {
  const values = section === 'Finance' ? [`Clean ${state.cleanBalance.toLocaleString('ro-RO')}`, `Dirty ${state.dirtyBalance.toLocaleString('ro-RO')}`] : section === 'Storage' ? [`Stock value ${state.stockValue.toLocaleString('ro-RO')}`] : section === 'Battles' ? [`Reputation ${state.battleReputation}`] : [];
  return <section className="hud-panel min-h-52 p-5"><h2 className="text-2xl font-black">{section}</h2>{values.length ? <div className="mt-4 flex flex-wrap gap-2">{values.map((value) => <span key={value} className="rounded-xl bg-white/5 px-4 py-3 text-sm font-bold">{value}</span>)}</div> : <p className="mt-3 text-sm text-white/50">Selectează acțiunea principală pentru această secțiune.</p>}</section>;
}
