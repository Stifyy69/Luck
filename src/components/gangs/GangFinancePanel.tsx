import { useState } from 'react';

type Currency = 'clean' | 'dirty';

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
  const [amount, setAmount] = useState('100000');
  const parsedAmount = Math.max(0, Math.floor(Number(amount) || 0));

  return (
    <div className="space-y-5">
      <section className="game-panel p-5 sm:p-7">
        <p className="section-kicker">Gang finance</p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white">Current money matters first.</h1>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Balance label="Gang clean balance" value={gangClean} tone="clean" />
          <Balance label="Gang dirty balance" value={gangDirty} tone="dirty" />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Balance label="Personal clean money" value={personalClean} subtle />
          <Balance label="Personal dirty money" value={personalDirty} subtle />
        </div>
      </section>

      <section className="game-panel-soft p-5 sm:p-6">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/28">Transfer money</p>
        <input
          type="number"
          min={0}
          step={10000}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="mt-3 w-full rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3 text-sm font-bold text-white outline-none"
          placeholder="Amount"
        />
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <FinanceButton label="Deposit clean" disabled={parsedAmount <= 0 || parsedAmount > personalClean} onClick={() => onDeposit('clean', parsedAmount)} />
          <FinanceButton label="Deposit dirty" disabled={parsedAmount <= 0 || parsedAmount > personalDirty} onClick={() => onDeposit('dirty', parsedAmount)} />
          <FinanceButton label="Withdraw clean" disabled={parsedAmount <= 0 || parsedAmount > gangClean} onClick={() => onWithdraw('clean', parsedAmount)} />
          <FinanceButton label="Withdraw dirty" disabled={parsedAmount <= 0 || parsedAmount > gangDirty} onClick={() => onWithdraw('dirty', parsedAmount)} />
        </div>
      </section>

      <section className="game-panel-soft p-5 sm:p-6">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-200/55">Money laundering</p>
        <p className="mt-2 text-sm text-white/55">Convert the selected Gang dirty amount into clean money at 65%.</p>
        <button type="button" disabled={parsedAmount <= 0 || parsedAmount > gangDirty} onClick={() => onLaunder(parsedAmount)} className="mt-4 rounded-xl border border-amber-300/15 bg-amber-400/[0.07] px-4 py-3 text-xs font-black text-amber-100 disabled:opacity-30">
          Launder {parsedAmount.toLocaleString('en-US')} dirty
        </button>
      </section>

      <section className="rounded-[20px] border border-white/[0.07] bg-black/20 p-4">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/25">Historical statistic</p>
        <p className="mt-2 text-lg font-black text-white/65">Total dirty earned: {totalEarned.toLocaleString('en-US')} $</p>
        <p className="mt-1 text-xs text-white/28">Used for Gang Level only. It is not the current balance.</p>
      </section>
    </div>
  );
}

function Balance({ label, value, tone, subtle }: { label: string; value: number; tone?: 'clean' | 'dirty'; subtle?: boolean }) {
  const toneClass = subtle
    ? 'border-white/[0.07] bg-black/20 text-white/65'
    : tone === 'clean'
      ? 'border-emerald-300/15 bg-emerald-400/[0.05] text-emerald-100'
      : 'border-amber-300/15 bg-amber-400/[0.05] text-amber-100';
  return (
    <div className={`rounded-[20px] border p-4 ${toneClass}`}>
      <p className="text-[9px] font-black uppercase tracking-[0.15em] opacity-50">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-[-0.035em]">{value.toLocaleString('en-US')} $</p>
    </div>
  );
}

function FinanceButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="btn-ghost rounded-xl px-3 py-3 text-[10px] disabled:opacity-30">{label}</button>;
}
