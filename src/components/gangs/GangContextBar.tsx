export type GangContextSection = 'overview' | 'work' | 'members' | 'recruitment' | 'storage' | 'finance' | 'battles';

const NAV_ITEMS: Array<{ section: GangContextSection; label: string; path: string }> = [
  { section: 'overview', label: 'Overview', path: '/gangs' },
  { section: 'work', label: 'Work', path: '/gangs/work' },
  { section: 'members', label: 'Members', path: '/gangs/members' },
  { section: 'recruitment', label: 'Recruitment', path: '/gangs/recruitment' },
  { section: 'storage', label: 'Storage', path: '/gangs/storage' },
  { section: 'finance', label: 'Finance', path: '/gangs/finance' },
  { section: 'battles', label: 'Battles', path: '/gangs/battles' },
];

function navigate(path: string) {
  if (window.location.pathname === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function GangContextBar({
  section,
  name,
  level,
  memberCount,
  maxMembers,
  cleanBalance,
  dirtyBalance,
  averageLoyalty,
  stockValue,
}: {
  section: GangContextSection;
  name: string;
  level: string;
  memberCount: number;
  maxMembers: number;
  cleanBalance: number;
  dirtyBalance: number;
  averageLoyalty: number;
  stockValue: number;
}) {
  return (
    <section className="game-panel mb-5 overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="section-kicker">Gang</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-black tracking-[-0.04em] text-white">{name}</h1>
            <span className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-white/45">{level}</span>
            <span className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-white/45">{memberCount}/{maxMembers} members</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
          <ContextStat label="Clean" value={cleanBalance.toLocaleString('en-US')} tone="clean" />
          <ContextStat label="Dirty" value={dirtyBalance.toLocaleString('en-US')} tone="dirty" />
          <ContextStat label="Loyalty" value={`${averageLoyalty}%`} />
          <ContextStat label="Storage" value={stockValue.toLocaleString('en-US')} />
        </div>
      </div>
      <div className="overflow-x-auto border-t border-white/[0.06] bg-black/15 px-2 py-2">
        <div className="flex min-w-max gap-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.section}
              type="button"
              onClick={() => navigate(item.path)}
              className={`rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-[0.11em] transition ${section === item.section ? 'bg-[var(--accent)] text-black' : 'text-white/38 hover:bg-white/[0.04] hover:text-white/70'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContextStat({ label, value, tone }: { label: string; value: string; tone?: 'clean' | 'dirty' }) {
  const valueClass = tone === 'clean' ? 'text-emerald-100' : tone === 'dirty' ? 'text-amber-100' : 'text-white/78';
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5">
      <p className="text-[7px] font-black uppercase tracking-[0.12em] text-white/25">{label}</p>
      <p className={`mt-1 truncate text-xs font-black ${valueClass}`}>{value}</p>
    </div>
  );
}
