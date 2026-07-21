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
  nextDirty,
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
  nextDirty: number | null;
}) {
  return (
    <div className="space-y-5">
      <section className="game-panel overflow-hidden p-5 sm:p-7">
        <p className="section-kicker">Gang overview</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-[-0.05em] text-white">{name}</h1>
            <p className="mt-2 text-sm text-white/40">{level}</p>
          </div>
          <span className="w-fit rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-white/55">
            {memberCount}/{maxMembers} members
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <MoneyCard label="Gang clean balance" value={cleanBalance} tone="clean" />
          <MoneyCard label="Gang dirty balance" value={dirtyBalance} tone="dirty" />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Members" value={`${memberCount}/${maxMembers}`} />
        <StatCard label="Working now" value={String(currentWorking)} />
        <StatCard label="Average loyalty" value={`${averageLoyalty}%`} />
        <StatCard label="Storage value" value={`${stockValue.toLocaleString('en-US')} $`} />
      </section>

      <section className="game-panel-soft p-5">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/28">Gang progression</p>
        <p className="mt-2 text-sm font-bold text-white/70">
          {nextDirty ? `Next gang level at ${nextDirty.toLocaleString('en-US')} total dirty earned.` : 'Maximum gang level reached.'}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-white/35">
          Current balances are shown first. Total earned is used only for gang level progression.
        </p>
      </section>
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
