import { useMemo, useState } from 'react';

type Currency = 'clean' | 'dirty';
type TransferMode = 'DEPOSIT_CLEAN' | 'DEPOSIT_DIRTY' | 'WITHDRAW_CLEAN' | 'WITHDRAW_DIRTY';

export default function GangFinancePanel({
  gangClean,
  gangDirty,
  personalClean,
  personalDirty,
  totalEarned,
  onDeposit,
  onWithdraw,
  onLaunder,
}: {
  gangClean: number;
  gangDirty: number;
  personalClean: number;
  personalDirty: number;
  totalEarned: number;
  onDeposit: (currency: Currency, amount: number) => void;
  onWithdraw: (currency: Currency, amount: number) => void;
  onLaunder: (amount: number) => void;
}) {
  const [mode, setMode] = useState<TransferMode>('DEPOSIT_DIRTY');
  const [amount, setAmount] = useState('100000');
  const [launderAmount, setLaunderAmount] = useState('100000');
  const parsedAmount = Math.max(0, Math.floor(Number(amount) || 0));
  const parsedLaunder = Math.max(0, Math.floor(Number(launderAmount) || 0));
  const transfer = useMemo(() => transferDetails(mode, { gangClean, gangDirty, personalClean, personalDirty }), [mode, gangClean, gangDirty, personalClean, personalDirty]);
  const canTransfer = parsedAmount > 0 && parsedAmount <= transfer.available;
  const cleanGain = Math.floor(parsedLaunder * 0.65);

  const submitTransfer = () => {
    if (!canTransfer) return;
    if (mode === 'DEPOSIT_CLEAN') onDeposit('clean', parsedAmount);
    if (mode === 'DEPOSIT_DIRTY') onDeposit('dirty', parsedAmount);
    if (mode === 'WITHDRAW_CLEAN') onWithdraw('clean', parsedAmount);
    if (mode === 'WITHDRAW_DIRTY') onWithdraw('dirty', parsedAmount);
  };

  return (
    <div className="space-y-4">
      <section className="game-panel p-5 sm:p-6">
        <p className="section-kicker">Gang finance</p>
        <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">Balances</h1>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Balance label="Gang clean" value={gangClean} tone="clean" />
          <Balance label="Gang dirty" value={gangDirty} tone="dirty" />
          <Balance label="Personal clean" value={personalClean} />
          <Balance label="Personal dirty" value={personalDirty} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="game-panel-soft p-5 sm:p-6">
          <p className="section-kicker">Transfer</p>
          <h2 className="mt-2 text-xl font-black text-white">Move money</h2>
          <label className="mt-4 block text-[8px] font-black uppercase tracking-[0.11em] text-white/28">Action</label>
          <select value={mode} onChange={(event) => setMode(event.target.value as TransferMode)} className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-3 text-xs font-black text-white/75 outline-none">
            <option value="DEPOSIT_CLEAN">Personal clean to Gang clean</option>
            <option value="DEPOSIT_DIRTY">Personal dirty to Gang dirty</option>
            <option value="WITHDRAW_CLEAN">Gang clean to Personal clean</option>
            <option value="WITHDRAW_DIRTY">Gang dirty to Personal dirty</option>
          </select>
          <div className="mt-3 grid grid-cols-2 gap-2"><Info label="From" value={transfer.from} /><Info label="Available" value={transfer.available.toLocaleString('en-US')} /></div>
          <label className="mt-4 block text-[8px] font-black uppercase tracking-[0.11em] text-white/28">Amount</label>
          <input type="number" min={0} step={10_000} value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-3 text-sm font-black text-white outline-none" />
          <button type="button" disabled={!canTransfer} onClick={submitTransfer} className="btn-primary mt-4 w-full rounded-xl px-4 py-3 text-xs disabled:opacity-30">Transfer {parsedAmount.toLocaleString('en-US')}</button>
        </div>

        <div className="game-panel-soft p-5 sm:p-6">
          <p className="section-kicker">Money laundering</p>
          <h2 className="mt-2 text-xl font-black text-white">Dirty to clean</h2>
          <div className="mt-4 grid grid-cols-2 gap-2"><Info label="Rate" value="65%" /><Info label="Gang dirty" value={gangDirty.toLocaleString('en-US')} /></div>
          <label className="mt-4 block text-[8px] font-black uppercase tracking-[0.11em] text-white/28">Dirty amount</label>
          <input type="number" min={0} step={10_000} value={launderAmount} onChange={(event) => setLaunderAmount(event.target.value)} className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-3 text-sm font-black text-white outline-none" />
          <div className="mt-3 rounded-xl border border-emerald-300/12 bg-emerald-400/[0.035] px-4 py-3"><p className="text-[8px] font-black uppercase tracking-[0.11em] text-emerald-100/45">Receive</p><p className="mt-1 text-xl font-black text-emerald-100">{cleanGain.toLocaleString('en-US')} clean</p></div>
          <button type="button" disabled={parsedLaunder <= 0 || parsedLaunder > gangDirty} onClick={() => onLaunder(parsedLaunder)} className="mt-4 w-full rounded-xl border border-amber-300/15 bg-amber-400/[0.07] px-4 py-3 text-xs font-black text-amber-100 disabled:opacity-30">Launder money</button>
        </div>
      </section>

      <section className="rounded-[18px] border border-white/[0.07] bg-black/20 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[8px] font-black uppercase tracking-[0.11em] text-white/25">Historical dirty earned</p><p className="text-sm font-black text-white/55">{totalEarned.toLocaleString('en-US')} $</p></div>
      </section>
    </div>
  );
}

function transferDetails(mode: TransferMode, values: { gangClean: number; gangDirty: number; personalClean: number; personalDirty: number }) {
  if (mode === 'DEPOSIT_CLEAN') return { from: 'Personal clean', available: values.personalClean };
  if (mode === 'DEPOSIT_DIRTY') return { from: 'Personal dirty', available: values.personalDirty };
  if (mode === 'WITHDRAW_CLEAN') return { from: 'Gang clean', available: values.gangClean };
  return { from: 'Gang dirty', available: values.gangDirty };
}

function Balance({ label, value, tone }: { label: string; value: number; tone?: 'clean' | 'dirty' }) {
  const valueClass = tone === 'clean' ? 'text-emerald-100' : tone === 'dirty' ? 'text-amber-100' : 'text-white/72';
  return <div className="rounded-[18px] border border-white/[0.07] bg-black/20 p-4"><p className="text-[8px] font-black uppercase tracking-[0.11em] text-white/25">{label}</p><p className={`mt-2 text-xl font-black tracking-[-0.03em] ${valueClass}`}>{value.toLocaleString('en-US')} $</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-3"><p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/25">{label}</p><p className="mt-1 truncate text-xs font-black text-white/72">{value}</p></div>;
}
