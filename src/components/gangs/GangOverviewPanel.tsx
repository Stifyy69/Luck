import type { GangActivityLogEntry } from '../../lib/gangActivity';
import type { GangUpgradeCost } from '../../lib/gangProgression';
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
  return (
    <div className="space-y-5">
      <section className="game-panel overflow-hidden p-5 sm:p-7">
        <p className="section-kicker">Gang overview</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-[-0.05em] text-white">{name}</h1>
            <p className="mt-2 text-sm font-black text-white/42">{level}</p>
          </div>
          <span className="w-fit rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-white/55">
            {memberCount}/{maxMembers} members
          </span>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <MoneyCard label="Gang clean" value={cleanBalance} tone="clean" />
          <MoneyCard label="Gang dirty" value={dirtyBalance} tone="dirty" />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Working" value={String(currentWorking)} />
        <StatCard label="Average loyalty" value={`${averageLoyalty}%`} />
        <StatCard label="Storage value" value={`${stockValue.toLocaleString('en-US')} $`} />
        <StatCard label="Battle reputation" value={battleReputation.toLocaleString('en-US')} />
      </section>

      <section className="game-panel-soft p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="section-kicker">Next level</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">{upgradeCost ? 'Upgrade requirements' : 'Maximum level'}</h2>
          </div>
          {upgradeCost ? (
            <button type="button" onClick={onUpgrade} className={`rounded-xl px-5 py-3 text-xs font-black uppercase tracking-[0.12em] ${canUpgrade ? 'btn-primary' : 'btn-ghost'}`}>
              Upgrade gang
            </button>
          ) : null}
        </div>
        {upgradeCost ? (
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Requirement label="Dirty" value={upgradeCost.dirtyCash} ready={dirtyBalance >= upgradeCost.dirtyCash} />
            <Requirement label="Leaves" value={upgradeCost.leaves} ready={resources.frunze >= upgradeCost.leaves} />
            <Requirement label="White" value={upgradeCost.white} ready={resources.white >= upgradeCost.white} />
            <Requirement label="Blue" value={upgradeCost.blue} ready={resources.blue >= upgradeCost.blue} />
          </div>
        ) : null}
      </section>

      <GangActivityLog entries={activityLog} />
    </div>
  );
}

function MoneyCard({ label, value, tone }: { label: string; value: number; tone: 'clean' | 'dirty' }) {
  const toneClass = tone === 'clean'
    ? 'border-emerald-300/15 bg-emerald-400/[0.055] text-emerald-100'
    : 'border-amber-300/15 bg-amber-400/[0.055] text-amber-100';
  return (
    <div className={`rounded-[22px] border p-5 ${toneClass}`}>
      <p className="text-[9px] font-black uppercase tracking-[0.17em] opacity-55">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-[-0.045em]">{value.toLocaleString('en-US')} $</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="game-panel-soft p-4 text-center">
      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/25">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function Requirement({ label, value, ready }: { label: string; value: number; ready: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-3 ${ready ? 'border-emerald-300/15 bg-emerald-400/[0.045]' : 'border-white/[0.07] bg-black/20'}`}>
      <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/28">{label}</p>
      <p className={`mt-1 text-sm font-black ${ready ? 'text-emerald-100' : 'text-white/72'}`}>{value.toLocaleString('en-US')}</p>
    </div>
  );
}
