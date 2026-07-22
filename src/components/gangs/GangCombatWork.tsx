import GangActionCard from './GangActionCard';

export default function GangCombatWork({
  busy,
  noMembers,
  levelIndex,
  memberCount,
  transportMembers,
  onTransportMembersChange,
  onTransport,
  onOpenBattles,
}: {
  busy: boolean;
  noMembers: boolean;
  levelIndex: number;
  memberCount: number;
  transportMembers: number;
  onTransportMembersChange: (value: number) => void;
  onTransport: () => void;
  onOpenBattles: () => void;
}) {
  const maxMembers = Math.max(1, memberCount);
  return (
    <section className="grid items-stretch gap-3 lg:grid-cols-2">
      <article className="flex min-h-[310px] flex-col rounded-[22px] border border-amber-300/12 bg-amber-400/[0.025] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-black text-white">Illegal Transport</p>
            <p className="mt-2 text-xs leading-5 text-white/40">More members increase the possible payout and exposure. Lower Gang levels are mainly for loyalty and progression.</p>
          </div>
          <span className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.11em] text-[var(--accent)]/70">+30m</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Info label="Gang level" value={`Level ${levelIndex + 1}`} />
          <Info label="Available" value={String(memberCount)} />
          <Info label="Loyalty" value="+5% to +15%" />
          <Info label="Incident cost" value="100,000 dirty" />
        </div>
        <div className="mt-auto pt-5">
          <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
            <div className="flex items-center justify-between text-xs"><span className="font-bold text-white/38">Members assigned</span><span className="font-black text-amber-100">{Math.min(transportMembers, maxMembers)}</span></div>
            <input type="range" min={1} max={maxMembers} value={Math.min(transportMembers, maxMembers)} disabled={busy || noMembers} onChange={(event) => onTransportMembersChange(Number(event.target.value))} className="mt-3 w-full accent-[var(--accent)]" />
          </div>
          <button type="button" disabled={busy || noMembers} onClick={onTransport} className="btn-primary mt-3 w-full rounded-xl px-4 py-3 text-xs disabled:opacity-30">Start transport</button>
        </div>
      </article>
      <GangActionCard
        title="Gang Battles"
        duration="+1h"
        description="Choose a crew, select a bot gang and review the matchup before starting."
        stats={[
          { label: 'Crew', value: 'Up to 5 members' },
          { label: 'Stages', value: 'Ambush, Firefight, Final Push' },
          { label: 'Rewards', value: 'Dirty, REP and materials' },
          { label: 'Risk', value: 'Temporary injuries' },
        ]}
        buttonLabel="Open Battle Center"
        disabled={busy || noMembers}
        onClick={onOpenBattles}
        tone="combat"
      />
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-3"><p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/25">{label}</p><p className="mt-1 text-xs font-black text-white/72">{value}</p></div>;
}
