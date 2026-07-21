import type { GangMember } from '../../lib/gangMembers';

export const LOYALTY_SUPPORT_OPTIONS = [
  { id: 'meal', label: 'Crew meal', cost: 25_000, loyalty: 3, description: 'Small morale boost for one member.' },
  { id: 'clothes', label: 'New clothes', cost: 100_000, loyalty: 6, description: 'A visible reward for reliable work.' },
  { id: 'phone', label: 'New phone', cost: 250_000, loyalty: 10, description: 'A premium personal reward.' },
  { id: 'safehouse', label: 'Safehouse support', cost: 500_000, loyalty: 15, description: 'Maximum loyalty support currently available.' },
] as const;

export default function GangLoyaltySupportModal({
  member,
  gangCleanBalance,
  onClose,
  onPurchase,
}: {
  member: GangMember | null;
  gangCleanBalance: number;
  onClose: () => void;
  onPurchase: (option: (typeof LOYALTY_SUPPORT_OPTIONS)[number]) => void;
}) {
  if (!member) return null;
  return (
    <div className="fixed inset-0 z-[135] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="game-panel w-full max-w-xl p-5 sm:p-6" onClick={(event) => event.stopPropagation()}>
        <p className="section-kicker">Member support</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">Reward {member.displayName}</h2>
        <p className="mt-2 text-sm text-white/40">Current loyalty: {member.loyalty}%. Purchases use Gang clean balance.</p>
        <p className="mt-1 text-xs font-black text-emerald-100/70">Available: {gangCleanBalance.toLocaleString('en-US')} clean</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {LOYALTY_SUPPORT_OPTIONS.map((option) => {
            const disabled = gangCleanBalance < option.cost || member.loyalty >= 100;
            return (
              <button key={option.id} type="button" disabled={disabled} onClick={() => onPurchase(option)} className="rounded-[18px] border border-white/[0.08] bg-black/20 p-4 text-left transition hover:bg-white/[0.035] disabled:opacity-30">
                <div className="flex items-center justify-between gap-3"><span className="text-sm font-black text-white">{option.label}</span><span className="text-xs font-black text-[var(--accent)]">+{option.loyalty}%</span></div>
                <p className="mt-2 text-[10px] leading-4 text-white/32">{option.description}</p>
                <p className="mt-3 text-xs font-black text-emerald-100/75">{option.cost.toLocaleString('en-US')} clean</p>
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onClose} className="btn-ghost mt-5 w-full rounded-xl px-4 py-3 text-xs">Close</button>
      </div>
    </div>
  );
}
