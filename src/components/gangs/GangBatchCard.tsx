export default function GangBatchCard({
  title,
  duration,
  inputName,
  inputAvailable,
  inputPerBatch,
  outputName,
  outputPerBatch,
  dirtyCostPerBatch,
  maximum,
  value,
  busy,
  onChange,
  onProcess,
}: {
  title: string;
  duration: string;
  inputName: string;
  inputAvailable: number;
  inputPerBatch: number;
  outputName: string;
  outputPerBatch: number;
  dirtyCostPerBatch: number;
  maximum: number;
  value: number;
  busy: boolean;
  onChange: (value: number) => void;
  onProcess: (batches: number) => void;
}) {
  const selected = maximum > 0 ? Math.max(1, Math.min(maximum, Math.floor(value || 1))) : 0;
  const disabled = busy || maximum <= 0;
  const inputTotal = selected * inputPerBatch;
  const outputTotal = selected * outputPerBatch;
  const dirtyTotal = selected * dirtyCostPerBatch;
  const quick = (ratio: number) => onChange(maximum > 0 ? Math.max(1, Math.floor(maximum * ratio)) : 0);

  return (
    <article className="flex h-full min-h-[390px] flex-col rounded-[22px] border border-white/[0.08] bg-black/20 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-white">{title}</p>
          <p className="mt-2 text-xs font-bold text-white/38">{inputPerBatch.toLocaleString('en-US')} {inputName} to {outputPerBatch.toLocaleString('en-US')} {outputName}</p>
        </div>
        <span className="shrink-0 rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.11em] text-[var(--accent)]/70">{duration}</span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <ValueBox label={`${inputName} available`} value={inputAvailable.toLocaleString('en-US')} />
        <ValueBox label="Maximum batches" value={maximum.toLocaleString('en-US')} />
        <ValueBox label="Consumes" value={`${inputTotal.toLocaleString('en-US')} ${inputName}`} />
        <ValueBox label="Produces" value={`${outputTotal.toLocaleString('en-US')} ${outputName}`} />
      </div>
      {dirtyCostPerBatch > 0 ? <p className="mt-3 text-[10px] font-black text-amber-100/55">Cost: {dirtyTotal.toLocaleString('en-US')} dirty</p> : null}

      <div className="mt-auto pt-5">
        <label className="text-[8px] font-black uppercase tracking-[0.11em] text-white/28">Batches</label>
        <input
          type="number"
          min={maximum > 0 ? 1 : 0}
          max={maximum}
          value={selected}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-sm font-black text-white outline-none disabled:opacity-30"
        />
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <button type="button" disabled={disabled} onClick={() => quick(0.25)} className="btn-ghost rounded-lg px-2 py-2 text-[9px] disabled:opacity-25">25%</button>
          <button type="button" disabled={disabled} onClick={() => quick(0.5)} className="btn-ghost rounded-lg px-2 py-2 text-[9px] disabled:opacity-25">50%</button>
          <button type="button" disabled={disabled} onClick={() => onChange(maximum)} className="btn-ghost rounded-lg px-2 py-2 text-[9px] disabled:opacity-25">MAX</button>
        </div>
        <button type="button" disabled={disabled} onClick={() => onProcess(selected)} className="btn-primary mt-3 w-full rounded-xl px-4 py-3 text-xs disabled:cursor-not-allowed disabled:opacity-30">
          {maximum <= 0 ? `Not enough ${inputName}` : `Process ${selected.toLocaleString('en-US')}`}
        </button>
      </div>
    </article>
  );
}

function ValueBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-3">
      <p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/25">{label}</p>
      <p className="mt-1 truncate text-xs font-black text-white/72">{value}</p>
    </div>
  );
}
