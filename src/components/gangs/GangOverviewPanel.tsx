import type { GangActivityLogEntry } from '../../lib/gangActivity';
import { getGangLevel, type GangUpgradeCost } from '../../lib/gangProgression';
import GangActivityLog from './GangActivityLog';

export default function GangOverviewPanel({
  name,
  level,
  memberCount,
  maxMembers,
  averageLoyalty,
  currentWorking,
  cleanBalance,
  dirtyBalance,
  stockValue,
  battleReputation,
  resources,
  upgradeCost,
  canUpgrade,
  activityLog,
  onUpgrade,
}: {
  name: string;
  level: string;
  memberCount: number;
  maxMembers: number;
  averageLoyalty: number;
  currentWorking: number;
  cleanBalance: number;
  dirtyBalance: number;
  stockValue: number;
  battleReputation: number;
  resources: { frunze: number; white: number; blue: number };
  upgradeCost: GangUpgradeCost | null;
  canUpgrade: boolean;
  activityLog: GangActivityLogEntry[];
  onUpgrade: () => void;
}) {
  const nextLevel = upgradeCost ? getGangLevel(upgradeCost.to).name : null;
  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="game-panel p-5 sm:p-6">
          <p className="section-kicker">Gang status</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black tracking-[-0.045em] text-white">{name}</h1>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-white/35">{level}</p>
            </div>
            <span className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.11em] text-white/45">{memberCount}/{maxMembers} members</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Money label="Gang clean" value={cleanBalance} tone="clean" />
            <Money label="Gang dirty" value={dirtyBalance} tone="dirty" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Mini label="Working" value={String(currentWorking)} />
            <Mini label="Loyalty" value={`${averageLoyalty}%`} />
            <Mini label="Storage" value={stockValue.toLocaleString('en-US')} />
            <Mini label="Reputation" value={battleReputation.toLocaleString('en-US')} />
          </div>
        </div>

        <div className="game-panel p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="section-kicker">Next level</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">{nextLevel ? `Upgrade to ${nextLevel}` : 'Maximum level reached'}</h2>
            </div>
            {upgradeCost ? <button type="button" disabled={!canUpgrade} onClick={onUpgrade} className="btn-primary rounded-xl px-4 py-2.5 text-[10px] disabled:cursor-not-allowed disabled:opacity-30">Upgrade Gang</button> : null}
          </div>
          {upgradeCost ? (
            <div className="mt-5 space-y-3">
              <Requirement label="Dirty" current={dirtyBalance} required={upgradeCost.dirtyCash} />
              <Requirement label="Leaves" current={resources.frunze} required={upgradeCost.leaves} />
              <Requirement label="White" current={resources.white} required={upgradeCost.white} />
              <Requirement label="Blue" current={resources.blue} required={upgradeCost.blue} />
            </div>
          ) : <div className="mt-6 rounded-xl border border-white/[0.07] bg-black/20 px-4 py-8 text-center text-sm font-bold text-white/30">No further Gang upgrades.</div>}
        </div>
      </section>
      <GangActivityLog entries={activityLog} />
    </div>
  );
}

function Money({ label, value, tone }: { label: string; value: number; tone: 'clean' | 'dirty' }) {
  const className = tone === 'clean' ? 'border-emerald-300/12 bg-emerald-400/[0.045] text-emerald-100' : 'border-amber-300/12 bg-amber-400/[0.045] text-amber-100';
  return <div className={`rounded-[18px] border p-4 ${className}`}><p className="text-[8px] font-black uppercase tracking-[0.13em] opacity-50">{label}</p><p className="mt-2 text-xl font-black tracking-[-0.03em]">{value.toLocaleString('en-US')} $</p></div>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-3"><p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/25">{label}</p><p className="mt-1 truncate text-xs font-black text-white/72">{value}</p></div>;
}

function Requirement({ label, current, required }: { label: string; current: number; required: number }) {
  const percent = Math.max(0, Math.min(100, Math.round((current / Math.max(1, required)) * 100)));
  const ready = current >= required;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[9px] font-black uppercase tracking-[0.1em]"><span className={ready ? 'text-emerald-100' : 'text-white/42'}>{label}</span><span className="text-white/50">{current.toLocaleString('en-US')} / {required.toLocaleString('en-US')}</span></div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.07]"><div className={`h-full rounded-full ${ready ? 'bg-emerald-300' : 'bg-[var(--accent)]'}`} style={{ width: `${percent}%` }} /></div>
    </div>
  );
}
