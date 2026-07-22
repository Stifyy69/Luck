export default function GangBatchCard({
  title,
  inputLabel,
  outputLabel,
  dirtyCost,
  maximum,
  value,
  disabled,
  onChange,
  onProcess,
}: {
  title: string;
  inputLabel: string;
  outputLabel: string;
  dirtyCost: number;
  maximum: number;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
  onProcess: () => void;
}) {
  const quick = (ratio: number) => onChange(Math.max(1, Math.floor(maximum * ratio)));
  return (
    <div className="rounded-[22px] border border-white/[0.08] bg-black/20 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-black text-white">{title}</p>
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-white/30">Max {maximum.toLocaleString('en-US')}</span>
      </div>
      <p className="mt-3 text-xs font-bold text-white/38">{inputLabel} to {outputLabel}</p>
      {dirtyCost > 0 ? <p className="mt-1 text-[10px] font-bold text-amber-100/55">{dirtyCost.toLocaleString('en-US')} dirty / batch</p> : null}
      <input type="number" min={1} max={Math.max(1, maximum)} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} className="mt-4 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-sm font-black text-white outline-none" />
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <button type="button" disabled={disabled} onClick={() => quick(0.25)} className="btn-ghost rounded-lg px-2 py-2 text-[9px] disabled:opacity-25">25%</button>
        <button type="button" disabled={disabled} onClick={() => quick(0.5)} className="btn-ghost rounded-lg px-2 py-2 text-[9px] disabled:opacity-25">50%</button>
        <button type="button" disabled={disabled} onClick={() => onChange(maximum)} className="btn-ghost rounded-lg px-2 py-2 text-[9px] disabled:opacity-25">MAX</button>
      </div>
      <button type="button" disabled={disabled} onClick={onProcess} className="btn-primary mt-3 w-full rounded-xl px-4 py-3 text-xs disabled:opacity-30">Process {value.toLocaleString('en-US')}</button>
    </div>
  );
}
