import { useEffect, useMemo, useState } from 'react';
import { previewGangBattle, type GangBattleHistoryEntry, type GangBotOpponent } from '../../lib/gangBattles';
import { getAvailableGangMembers, getMemberRole, type GangMember } from '../../lib/gangMembers';

type BattleTab = 'battle' | 'defense' | 'recovery' | 'history';
type BattleStep = 1 | 2 | 3;

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
  const [tab, setTab] = useState<BattleTab>('battle');
  const [step, setStep] = useState<BattleStep>(1);
  const available = useMemo(() => getAvailableGangMembers(members, currentGameHour), [members, currentGameHour]);
  const injured = useMemo(() => members.filter((member) => member.injuredUntilGameHour > currentGameHour), [members, currentGameHour]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [leaderId, setLeaderId] = useState('');
  const [opponentId, setOpponentId] = useState('');
  const [defenseIds, setDefenseIds] = useState<string[]>(defensiveCrewIds);

  useEffect(() => {
    setSelectedIds((current) => {
      const valid = current.filter((id) => available.some((member) => member.id === id)).slice(0, 5);
      return valid.length ? valid : available.slice(0, 5).map((member) => member.id);
    });
  }, [available.map((member) => member.id).join('|')]);
  useEffect(() => { if (!selectedIds.includes(leaderId)) setLeaderId(selectedIds[0] || ''); }, [selectedIds, leaderId]);
  useEffect(() => { setDefenseIds(defensiveCrewIds.filter((id) => available.some((member) => member.id === id)).slice(0, 5)); }, [defensiveCrewIds.join('|'), available.map((member) => member.id).join('|')]);

  const selectedMembers = selectedIds.map((id) => available.find((member) => member.id === id)).filter((member): member is GangMember => Boolean(member));
  const selectedOpponent = opponents.find((opponent) => opponent.id === opponentId) || null;
  const preview = selectedOpponent ? previewGangBattle(selectedMembers, leaderId, selectedOpponent) : null;

  const toggleSelected = (memberId: string) => setSelectedIds((current) => current.includes(memberId) ? current.filter((id) => id !== memberId) : current.length >= 5 ? current : [...current, memberId]);
  const toggleDefense = (memberId: string) => setDefenseIds((current) => current.includes(memberId) ? current.filter((id) => id !== memberId) : current.length >= 5 ? current : [...current, memberId]);

  return (
    <div className="space-y-4">
      <section className="game-panel p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="section-kicker">Gang battles</p><h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">Battle Center</h1></div>
          <div className="flex gap-2"><Badge label="Reputation" value={reputation.toLocaleString('en-US')} /><Badge label="Available" value={String(available.length)} /></div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-1 rounded-2xl border border-white/[0.07] bg-black/25 p-1">
          {(['battle', 'defense', 'recovery', 'history'] as BattleTab[]).map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-xl px-2 py-2.5 text-[8px] font-black uppercase tracking-[0.1em] sm:text-[9px] ${tab === item ? 'bg-[var(--accent)] text-black' : 'text-white/38'}`}>{item}</button>)}
        </div>
      </section>

      {tab === 'battle' ? (
        <>
          <BattleSteps step={step} />
          {step === 1 ? (
            <section className="game-panel-soft p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="section-kicker">Step 1</p><h2 className="mt-2 text-2xl font-black text-white">Select crew and leader</h2><p className="mt-1 text-xs text-white/35">Choose up to five available members.</p></div><span className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-[9px] font-black text-white/50">{selectedIds.length}/5 selected</span></div>
              <CrewSelector members={available} selectedIds={selectedIds} leaderId={leaderId} onToggle={toggleSelected} onLeader={setLeaderId} />
              <button type="button" disabled={!selectedIds.length || !leaderId} onClick={() => setStep(2)} className="btn-primary mt-5 w-full rounded-xl px-4 py-3 text-xs disabled:opacity-30">Continue to opponents</button>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="game-panel-soft p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="section-kicker">Step 2</p><h2 className="mt-2 text-2xl font-black text-white">Choose an opponent</h2><p className="mt-1 text-xs text-white/35">Compare one clear matchup at a time.</p></div><button type="button" disabled={busy} onClick={onRefreshOpponents} className="btn-ghost rounded-xl px-4 py-2.5 text-[9px] disabled:opacity-30">Refresh bots</button></div>
              <div className="mt-5 grid gap-3 xl:grid-cols-3">
                {opponents.map((opponent) => {
                  const matchup = previewGangBattle(selectedMembers, leaderId, opponent);
                  return <article key={opponent.id} className="flex h-full flex-col rounded-[20px] border border-white/[0.08] bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-base font-black text-white">{opponent.name}</p><p className="mt-1 text-[8px] font-black uppercase tracking-[0.11em] text-red-100/45">{opponent.difficulty} · {opponent.specialty}</p></div><span className="text-[9px] font-black text-white/30">{opponent.members.length} members</span></div><div className="mt-4 grid grid-cols-2 gap-2"><Info label="Matchup" value={matchup.comparison} /><Info label="Injury risk" value={`${matchup.injuryRisk}%`} /><Info label="Enemy power" value={matchup.opponentPower.toLocaleString('en-US')} /><Info label="Dirty reward" value={opponent.dirtyReward.toLocaleString('en-US')} /></div><button type="button" onClick={() => { setOpponentId(opponent.id); setStep(3); }} className="btn-primary mt-auto w-full rounded-xl px-4 py-3 text-xs">Select opponent</button></article>;
                })}
              </div>
              <button type="button" onClick={() => setStep(1)} className="btn-ghost mt-4 rounded-xl px-4 py-2.5 text-[9px]">Back to crew</button>
            </section>
          ) : null}

          {step === 3 && selectedOpponent && preview ? (
            <section className="game-panel-soft p-5 sm:p-6">
              <p className="section-kicker">Step 3</p><h2 className="mt-2 text-2xl font-black text-white">Review the battle</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <Side label="Your gang" name={`${selectedIds.length} members`} power={preview.playerPower} detail={`Leader: ${selectedMembers.find((member) => member.id === leaderId)?.nickname || 'None'}`} />
                <Side label="Opponent" name={selectedOpponent.name} power={preview.opponentPower} detail={`${selectedOpponent.difficulty} · ${selectedOpponent.specialty}`} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><Info label="Matchup" value={preview.comparison} /><Info label="Injury risk" value={`${preview.injuryRisk}%`} /><Info label="Game time" value="+1h" /><Info label="Reputation" value={`+${selectedOpponent.reputationReward}`} /></div>
              <div className="mt-3 rounded-xl border border-emerald-300/12 bg-emerald-400/[0.035] p-4"><p className="text-[8px] font-black uppercase tracking-[0.11em] text-emerald-100/45">Possible rewards</p><p className="mt-2 text-lg font-black text-emerald-100">{selectedOpponent.dirtyReward.toLocaleString('en-US')} dirty</p><p className="mt-1 text-[9px] font-bold text-white/35">{selectedOpponent.gunpowderReward} Gunpowder · {selectedOpponent.steelReward} Steel</p></div>
              <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={() => setStep(2)} className="btn-ghost rounded-xl px-4 py-3 text-xs">Back</button><button type="button" disabled={busy} onClick={() => onAttack(selectedOpponent, selectedIds, leaderId)} className="btn-primary rounded-xl px-4 py-3 text-xs disabled:opacity-30">Start battle</button></div>
            </section>
          ) : null}
        </>
      ) : null}

      {tab === 'defense' ? <section className="game-panel-soft p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="section-kicker">Defensive crew</p><h2 className="mt-2 text-2xl font-black text-white">Save your defense</h2></div><span className="text-sm font-black text-white/45">{defenseIds.length}/5</span></div><CrewSelector members={available} selectedIds={defenseIds} leaderId="" onToggle={toggleDefense} /><button type="button" disabled={busy || !defenseIds.length} onClick={() => onSaveDefense(defenseIds)} className="btn-primary mt-5 w-full rounded-xl px-4 py-3 text-xs disabled:opacity-30">Save defensive crew</button></section> : null}

      {tab === 'recovery' ? <section className="game-panel-soft p-5 sm:p-6"><div className="flex items-end justify-between gap-3"><div><p className="section-kicker">Recovery</p><h2 className="mt-2 text-2xl font-black text-white">{injured.length} injured members</h2></div><Badge label="Gang clean" value={gangCleanBalance.toLocaleString('en-US')} /></div><div className="mt-5 grid gap-3 md:grid-cols-2">{injured.length ? injured.map((member) => { const remaining = Math.max(1, Math.ceil(member.injuredUntilGameHour - currentGameHour)); const cost = remaining * 75_000; return <div key={member.id} className="rounded-xl border border-red-300/12 bg-red-400/[0.03] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-white">{member.displayName}</p><p className="mt-1 text-[9px] font-bold text-red-100/50">{remaining}h game time remaining</p></div><span className="text-xs font-black text-white/55">{cost.toLocaleString('en-US')} clean</span></div><button type="button" disabled={busy || gangCleanBalance < cost} onClick={() => onTreat(member.id)} className="btn-primary mt-4 w-full rounded-xl px-3 py-2.5 text-[9px] disabled:opacity-30">Treat now</button></div>; }) : <Empty text="No injured members" />}</div></section> : null}

      {tab === 'history' ? <section className="game-panel-soft p-5 sm:p-6"><p className="section-kicker">Battle history</p><div className="mt-4 space-y-2">{history.length ? history.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3"><div><p className="text-sm font-black text-white">{entry.opponentName}</p><p className="mt-1 text-[9px] text-white/30">{entry.injuries.length} injured · +{entry.reputationReward} REP · +{entry.dirtyReward.toLocaleString('en-US')} dirty</p></div><span className={`rounded-full border px-3 py-1.5 text-xs font-black ${entry.won ? 'border-emerald-300/15 bg-emerald-400/[0.05] text-emerald-100' : 'border-red-300/15 bg-red-400/[0.05] text-red-100'}`}>{entry.score}</span></div>) : <Empty text="No battles yet" />}</div></section> : null}
    </div>
  );
}

function BattleSteps({ step }: { step: BattleStep }) {
  return <div className="grid grid-cols-3 gap-2">{['Crew', 'Opponent', 'Preview'].map((label, index) => { const number = index + 1; const active = number === step; const done = number < step; return <div key={label} className={`rounded-xl border px-3 py-3 text-center ${active ? 'border-[rgba(211,255,81,0.25)] bg-[rgba(211,255,81,0.055)]' : done ? 'border-emerald-300/12 bg-emerald-400/[0.03]' : 'border-white/[0.07] bg-black/20'}`}><p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/28">Step {number}</p><p className={`mt-1 text-xs font-black ${active ? 'text-[var(--accent)]' : 'text-white/55'}`}>{label}</p></div>; })}</div>;
}

function CrewSelector({ members, selectedIds, leaderId, onToggle, onLeader }: { members: GangMember[]; selectedIds: string[]; leaderId: string; onToggle: (id: string) => void; onLeader?: (id: string) => void }) {
  return <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{members.map((member) => { const selected = selectedIds.includes(member.id); return <div key={member.id} className={`rounded-xl border p-3 ${selected ? 'border-[rgba(211,255,81,0.22)] bg-[rgba(211,255,81,0.05)]' : 'border-white/[0.07] bg-black/20'}`}><button type="button" onClick={() => onToggle(member.id)} className="w-full text-left"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-black text-white">{member.displayName}</p><p className="mt-1 text-[8px] font-black uppercase tracking-[0.1em] text-white/28">{getMemberRole(member)} · Lv {member.level}</p></div><span className={`h-5 w-5 shrink-0 rounded-md border ${selected ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-white/15 bg-black/20'}`} /></div></button>{selected && onLeader ? <button type="button" onClick={() => onLeader(member.id)} className={`mt-2 w-full rounded-lg border px-2 py-1.5 text-[8px] font-black uppercase tracking-[0.1em] ${leaderId === member.id ? 'border-amber-300/20 bg-amber-400/[0.08] text-amber-100' : 'border-white/[0.07] text-white/30'}`}>{leaderId === member.id ? 'Leader selected' : 'Set as leader'}</button> : null}</div>; })}</div>;
}

function Side({ label, name, power, detail }: { label: string; name: string; power: number; detail: string }) { return <div className="rounded-[18px] border border-white/[0.08] bg-black/20 p-4"><p className="text-[8px] font-black uppercase tracking-[0.11em] text-white/25">{label}</p><p className="mt-2 text-lg font-black text-white">{name}</p><p className="mt-3 text-3xl font-black text-[var(--accent)]">{power.toLocaleString('en-US')}</p><p className="mt-1 text-[9px] text-white/32">{detail}</p></div>; }
function Badge({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2"><p className="text-[7px] font-black uppercase tracking-[0.1em] text-white/24">{label}</p><p className="mt-1 text-xs font-black text-white/70">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-3"><p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/25">{label}</p><p className="mt-1 truncate text-xs font-black text-white/72">{value}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-10 text-center text-sm font-bold text-white/25">{text}</div>; }
