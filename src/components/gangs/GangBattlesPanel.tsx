import { useEffect, useMemo, useState } from 'react';
import {
  previewGangBattle,
  type GangBattleHistoryEntry,
  type GangBotOpponent,
} from '../../lib/gangBattles';
import { getAvailableGangMembers, getMemberRole, type GangMember } from '../../lib/gangMembers';

type BattleTab = 'opponents' | 'defense' | 'recovery' | 'history';

export default function GangBattlesPanel({
  opponents,
  members,
  currentGameHour,
  defensiveCrewIds,
  history,
  reputation,
  gangCleanBalance,
  busy,
  onAttack,
  onSaveDefense,
  onTreat,
  onRefreshOpponents,
}: {
  opponents: GangBotOpponent[];
  members: GangMember[];
  currentGameHour: number;
  defensiveCrewIds: string[];
  history: GangBattleHistoryEntry[];
  reputation: number;
  gangCleanBalance: number;
  busy: boolean;
  onAttack: (opponent: GangBotOpponent, memberIds: string[], leaderId: string) => void;
  onSaveDefense: (memberIds: string[]) => void;
  onTreat: (memberId: string) => void;
  onRefreshOpponents: () => void;
}) {
  const [tab, setTab] = useState<BattleTab>('opponents');
  const available = useMemo(() => getAvailableGangMembers(members, currentGameHour), [members, currentGameHour]);
  const injured = useMemo(() => members.filter((member) => member.injuredUntilGameHour > currentGameHour), [members, currentGameHour]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [leaderId, setLeaderId] = useState('');
  const [defenseIds, setDefenseIds] = useState<string[]>(defensiveCrewIds);

  useEffect(() => {
    setSelectedIds((current) => {
      const valid = current.filter((id) => available.some((member) => member.id === id)).slice(0, 5);
      return valid.length > 0 ? valid : available.slice(0, 5).map((member) => member.id);
    });
  }, [available.map((member) => member.id).join('|')]);

  useEffect(() => {
    if (!selectedIds.includes(leaderId)) setLeaderId(selectedIds[0] || '');
  }, [selectedIds, leaderId]);

  useEffect(() => {
    setDefenseIds(defensiveCrewIds.filter((id) => available.some((member) => member.id === id)).slice(0, 5));
  }, [defensiveCrewIds.join('|'), available.map((member) => member.id).join('|')]);

  const selectedMembers = selectedIds.map((id) => available.find((member) => member.id === id)).filter((member): member is GangMember => Boolean(member));

  const toggleSelected = (memberId: string) => {
    setSelectedIds((current) => current.includes(memberId)
      ? current.filter((id) => id !== memberId)
      : current.length >= 5 ? current : [...current, memberId]);
  };

  const toggleDefense = (memberId: string) => {
    setDefenseIds((current) => current.includes(memberId)
      ? current.filter((id) => id !== memberId)
      : current.length >= 5 ? current : [...current, memberId]);
  };

  return (
    <div className="space-y-5">
      <section className="game-panel p-5 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-kicker">Gang battles</p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white">Battle Center</h1>
          </div>
          <div className="flex items-center gap-2">
            <StatBadge label="Reputation" value={reputation.toLocaleString('en-US')} />
            <StatBadge label="Available" value={String(available.length)} />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-4 gap-1 rounded-2xl border border-white/[0.07] bg-black/25 p-1">
          {(['opponents', 'defense', 'recovery', 'history'] as BattleTab[]).map((item) => (
            <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-xl px-2 py-2.5 text-[8px] font-black uppercase tracking-[0.1em] sm:text-[9px] ${tab === item ? 'bg-[var(--accent)] text-black' : 'text-white/38'}`}>
              {item}
            </button>
          ))}
        </div>
      </section>

      {tab === 'opponents' ? (
        <>
          <section className="game-panel-soft p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3"><div><p className="section-kicker">Battle crew</p><h2 className="mt-2 text-2xl font-black text-white">{selectedIds.length}/5 selected</h2></div><button type="button" onClick={onRefreshOpponents} disabled={busy} className="btn-ghost rounded-xl px-4 py-2.5 text-[10px] disabled:opacity-30">Refresh bots</button></div>
            <MemberSelector members={available} selectedIds={selectedIds} leaderId={leaderId} onToggle={toggleSelected} onLeader={setLeaderId} />
          </section>
          <section className="grid gap-3 xl:grid-cols-3">
            {opponents.map((opponent) => {
              const preview = previewGangBattle(selectedMembers, leaderId, opponent);
              return (
                <article key={opponent.id} className="rounded-[22px] border border-red-300/12 bg-red-500/[0.035] p-5">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-lg font-black text-white">{opponent.name}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-red-100/50">{opponent.difficulty} · {opponent.specialty}</p></div><span className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-[9px] font-black text-white/45">{opponent.members.length} members</span></div>
                  <div className="mt-4 grid grid-cols-2 gap-2"><PowerCard label="Your power" value={preview.playerPower} /><PowerCard label="Enemy power" value={preview.opponentPower} /></div>
                  <div className="mt-3 grid grid-cols-2 gap-2"><MiniValue label="Matchup" value={preview.comparison} /><MiniValue label="Injury risk" value={`${preview.injuryRisk}%`} /></div>
                  <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/20 p-3"><p className="text-[8px] font-black uppercase tracking-[0.11em] text-white/25">Victory reward</p><p className="mt-1 text-sm font-black text-emerald-100">{opponent.dirtyReward.toLocaleString('en-US')} dirty</p><p className="mt-1 text-[9px] font-bold text-white/30">+{opponent.reputationReward} REP · +{opponent.gunpowderReward} Gunpowder · +{opponent.steelReward} Steel</p></div>
                  <button type="button" disabled={busy || selectedMembers.length === 0 || !leaderId} onClick={() => onAttack(opponent, selectedIds, leaderId)} className="btn-primary mt-4 w-full rounded-xl px-4 py-3 text-xs disabled:opacity-30">Attack</button>
                </article>
              );
            })}
          </section>
        </>
      ) : null}

      {tab === 'defense' ? (
        <section className="game-panel-soft p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="section-kicker">Defensive crew</p><h2 className="mt-2 text-2xl font-black text-white">{defenseIds.length}/5 selected</h2></div><button type="button" onClick={() => onSaveDefense(defenseIds)} disabled={busy || defenseIds.length === 0} className="btn-primary rounded-xl px-4 py-2.5 text-[10px] disabled:opacity-30">Save defense</button></div>
          <MemberSelector members={available} selectedIds={defenseIds} leaderId="" onToggle={toggleDefense} />
        </section>
      ) : null}

      {tab === 'recovery' ? (
        <section className="game-panel-soft p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="section-kicker">Recovery</p><h2 className="mt-2 text-2xl font-black text-white">{injured.length} injured</h2></div><StatBadge label="Gang clean" value={gangCleanBalance.toLocaleString('en-US')} /></div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {injured.length > 0 ? injured.map((member) => {
              const remaining = Math.max(1, Math.ceil(member.injuredUntilGameHour - currentGameHour));
              const cost = remaining * 75_000;
              return <div key={member.id} className="rounded-[18px] border border-red-300/12 bg-red-400/[0.035] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-white">{member.displayName}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[0.11em] text-red-100/50">{remaining}h remaining</p></div><span className="text-xs font-black text-white/55">{cost.toLocaleString('en-US')} clean</span></div><button type="button" disabled={busy || gangCleanBalance < cost} onClick={() => onTreat(member.id)} className="btn-primary mt-4 w-full rounded-xl px-3 py-2.5 text-[10px] disabled:opacity-30">Treat now</button></div>;
            }) : <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-10 text-center text-sm font-bold text-white/25 md:col-span-2">No injured members</div>}
          </div>
        </section>
      ) : null}

      {tab === 'history' ? (
        <section className="game-panel-soft p-5 sm:p-6">
          <p className="section-kicker">Battle history</p>
          <div className="mt-5 space-y-2">
            {history.length > 0 ? history.map((entry) => <div key={entry.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3"><div><p className="text-sm font-black text-white">{entry.opponentName}</p><p className="mt-1 text-[9px] font-bold text-white/30">{entry.injuries.length} injured · +{entry.reputationReward} REP · +{entry.dirtyReward.toLocaleString('en-US')} dirty</p></div><span className={`rounded-full border px-3 py-1.5 text-xs font-black ${entry.won ? 'border-emerald-300/15 bg-emerald-400/[0.05] text-emerald-100' : 'border-red-300/15 bg-red-400/[0.05] text-red-100'}`}>{entry.score}</span></div>) : <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-10 text-center text-sm font-bold text-white/25">No battles yet</div>}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function MemberSelector({ members, selectedIds, leaderId, onToggle, onLeader }: { members: GangMember[]; selectedIds: string[]; leaderId: string; onToggle: (memberId: string) => void; onLeader?: (memberId: string) => void }) {
  return (
    <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {members.map((member) => {
        const selected = selectedIds.includes(member.id);
        const injured = member.status === 'INJURED';
        return <div key={member.id} className={`rounded-xl border p-3 ${selected ? 'border-[rgba(211,255,81,0.24)] bg-[rgba(211,255,81,0.055)]' : 'border-white/[0.07] bg-black/20'} ${injured ? 'opacity-45' : ''}`}><button type="button" disabled={injured} onClick={() => onToggle(member.id)} className="w-full text-left"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-black text-white">{member.displayName}</p><p className="mt-1 text-[8px] font-black uppercase tracking-[0.1em] text-white/28">{getMemberRole(member)} · Lv {member.level}</p></div><span className={`h-5 w-5 shrink-0 rounded-md border ${selected ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-white/15 bg-black/20'}`} /></div></button>{selected && onLeader ? <button type="button" onClick={() => onLeader(member.id)} className={`mt-2 w-full rounded-lg border px-2 py-1.5 text-[8px] font-black uppercase tracking-[0.1em] ${leaderId === member.id ? 'border-amber-300/20 bg-amber-400/[0.08] text-amber-100' : 'border-white/[0.07] text-white/30'}`}>{leaderId === member.id ? 'Leader' : 'Set leader'}</button> : null}</div>;
      })}
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2"><p className="text-[7px] font-black uppercase tracking-[0.1em] text-white/24">{label}</p><p className="mt-1 text-xs font-black text-white/70">{value}</p></div>;
}
function PowerCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3"><p className="text-[8px] font-black uppercase tracking-[0.11em] text-white/25">{label}</p><p className="mt-1 text-lg font-black text-white">{value.toLocaleString('en-US')}</p></div>;
}
function MiniValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3"><p className="text-[8px] font-black uppercase tracking-[0.11em] text-white/25">{label}</p><p className="mt-1 text-[10px] font-black text-white/65">{value}</p></div>;
}
