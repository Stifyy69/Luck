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
  return (
    <section className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-[22px] border border-amber-300/15 bg-amber-400/[0.045] p-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-lg font-black text-white">&#73;llegal Transport</p><p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100/55">+30m</p></div>
          <span className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1 text-[9px] font-black uppercase tracking-[0.11em] text-white/45">Level {levelIndex + 1}</span>
        </div>
        <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/20 p-3">
          <div className="flex items-center justify-between text-xs"><span className="font-bold text-white/40">Members</span><span className="font-black text-amber-100">{transportMembers}</span></div>
          <input type="range" min={1} max={Math.max(1, memberCount)} value={Math.min(Math.max(1, transportMembers), Math.max(1, memberCount))} disabled={busy || noMembers} onChange={(event) => onTransportMembersChange(Number(event.target.value))} className="mt-3 w-full accent-[var(--accent)]" />
        </div>
        <button type="button" disabled={busy || noMembers} onClick={onTransport} className="btn-primary mt-4 w-full rounded-xl px-4 py-3 text-xs disabled:opacity-35">Start transport</button>
      </div>
      <div className="rounded-[22px] border border-red-300/15 bg-red-400/[0.04] p-5">
        <p className="text-lg font-black text-white">Gang Battles</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <MiniStat label="Stages" value="3" />
          <MiniStat label="Crew" value="5 max" />
          <MiniStat label="Time" value="+1h" />
        </div>
        <button type="button" onClick={onOpenBattles} className="btn-primary mt-5 w-full rounded-xl px-4 py-3 text-xs">Open battles</button>
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3 text-center"><p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/25">{label}</p><p className="mt-1 text-xs font-black text-white/70">{value}</p></div>;
}
