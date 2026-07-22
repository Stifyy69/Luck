import type { GangUpgradeCost } from '../../lib/gangProgression';

export default function GangUpgradeModal({
  cost,
  currentLevel,
  nextLevel,
  balances,
  onClose,
  onConfirm,
}: {
  cost: GangUpgradeCost | null;
  currentLevel: string;
  nextLevel: string | null;
  balances: { dirtyBalance: number; frunze: number; white: number; blue: number };
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!cost || !nextLevel) return null;
  const requirements = [
    { label: 'Dirty', required: cost.dirtyCash, current: balances.dirtyBalance },
    { label: 'Leaves', required: cost.leaves, current: balances.frunze },
    { label: 'White', required: cost.white, current: balances.white },
    { label: 'Blue', required: cost.blue, current: balances.blue },
  ];
  const canUpgrade = requirements.every((item) => item.current >= item.required);
  return (
    <div className="fixed inset-0 z-[135] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="game-panel w-full max-w-lg p-5 sm:p-6" onClick={(event) => event.stopPropagation()}>
        <p className="section-kicker">Gang upgrade</p>
        <h2 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white">{currentLevel} to {nextLevel}</h2>
        <div className="mt-5 grid grid-cols-2 gap-2">
          {requirements.map((item) => {
            const ready = item.current >= item.required;
            return (
              <div key={item.label} className={`rounded-xl border p-3 ${ready ? 'border-emerald-300/15 bg-emerald-400/[0.05]' : 'border-red-300/15 bg-red-400/[0.045]'}`}>
                <p className="text-[9px] font-black uppercase tracking-[0.13em] text-white/30">{item.label}</p>
                <p className={`mt-2 text-sm font-black ${ready ? 'text-emerald-100' : 'text-red-100'}`}>{item.required.toLocaleString('en-US')}</p>
                <p className="mt-1 text-[9px] font-bold text-white/25">Have {item.current.toLocaleString('en-US')}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="btn-ghost rounded-xl px-4 py-3 text-sm">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={!canUpgrade} className="btn-primary rounded-xl px-4 py-3 text-sm disabled:opacity-30">Upgrade</button>
        </div>
      </div>
    </div>
  );
}
