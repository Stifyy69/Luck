import type { AdminAction } from '../../lib/adminApi';

export default function AdminAudit({ actions }: { actions: AdminAction[] }) {
  return (
    <section className="game-panel-soft overflow-hidden">
      <div className="border-b border-white/[0.07] p-5 sm:p-6"><p className="section-kicker">Immutable history</p><h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">Admin audit log</h2><p className="mt-2 text-sm text-white/35">Every economy, item, VIP, identity and tutorial change is recorded here.</p></div>
      <div className="divide-y divide-white/[0.06]">
        {actions.length > 0 ? actions.map((action) => (
          <div key={action.id} className="grid gap-3 p-4 sm:grid-cols-[170px_minmax(0,1fr)_220px] sm:items-center sm:px-6">
            <div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--accent)]">{action.actionType.replaceAll('_', ' ')}</p><p className="mt-1 text-[10px] text-white/25">by {action.adminName}</p></div>
            <div className="min-w-0"><p className="truncate text-sm font-black text-white">{action.playerId || 'System'}</p><p className="mt-1 break-all text-[10px] text-white/30">{JSON.stringify(action.actionPayload)}</p></div>
            <p className="text-xs text-white/28 sm:text-right">{new Date(action.createdAt).toLocaleString()}</p>
          </div>
        )) : <p className="p-10 text-center text-sm text-white/30">No admin actions recorded.</p>}
      </div>
    </section>
  );
}
