import {
  GANG_MEMBER_SKILLS,
  RARITY_LABELS,
  RARITY_STYLES,
  SKILL_LABELS,
  getMemberRole,
  getPrimarySkill,
  memberXpForNextLevel,
  type GangMember,
} from '../../lib/gangMembers';

export default function GangMemberCard({
  member,
  currentGameHour,
  disabled,
  onDismiss,
  onSupport,
}: {
  member: GangMember;
  currentGameHour: number;
  disabled: boolean;
  onDismiss: (member: GangMember) => void;
  onSupport: (member: GangMember) => void;
}) {
  const primarySkill = getPrimarySkill(member);
  const xpNeeded = memberXpForNextLevel(member.level);
  const xpPercent = member.level >= 50 ? 100 : Math.min(100, Math.round((member.xp / xpNeeded) * 100));
  const initials = `${member.firstName.slice(0, 1)}${member.nickname.slice(0, 1)}`.toUpperCase();
  const injuryHours = Math.max(0, Math.ceil(member.injuredUntilGameHour - currentGameHour));
  const status = injuryHours > 0 ? 'INJURED' : member.status;

  return (
    <article className={`overflow-hidden rounded-[22px] border ${RARITY_STYLES[member.rarity]}`}>
      <div className="border-b border-white/[0.07] bg-black/20 p-4">
        <div className="flex items-start gap-3">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30 text-base font-black text-white">
            <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.16),transparent_45%)]" />
            <span className="relative">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-current/20 bg-black/20 px-2 py-1 text-[8px] font-black uppercase tracking-[0.14em]">{RARITY_LABELS[member.rarity]}</span>
              {member.source === 'ADMIN_EVENT' ? <span className="rounded-full border border-rose-300/20 bg-rose-400/[0.08] px-2 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-rose-100">Event exclusive</span> : null}
              <span className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.14em] ${statusClass(status)}`}>{status === 'INJURED' ? `${injuryHours}h injured` : status === 'WORKING' ? 'Working' : 'Available'}</span>
            </div>
            <h3 className="mt-2 truncate text-base font-black tracking-[-0.025em] text-white">{member.displayName}</h3>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.13em] text-white/35">{getMemberRole(member)} · Lv. {member.level}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <StatPill label="Loyalty" value={`${member.loyalty}%`} tone={member.loyalty < 45 ? 'danger' : member.loyalty < 65 ? 'warning' : 'normal'} />
          <StatPill label="Main skill" value={`${SKILL_LABELS[primarySkill]} ${member.skills[primarySkill]}`} />
          <StatPill label="Last work" value={formatWork(member.lastWorkType)} />
          <StatPill label="Fatigue" value={`${member.consecutiveWorkRuns}/2`} tone={member.consecutiveWorkRuns >= 1 ? 'warning' : 'normal'} />
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between gap-3 text-[9px] font-black uppercase tracking-[0.12em] text-white/30"><span>Member XP</span><span>{member.level >= 50 ? 'MAX' : `${member.xp} / ${xpNeeded}`}</span></div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500" style={{ width: `${xpPercent}%` }} /></div>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {GANG_MEMBER_SKILLS.map((skill) => (
            <div key={skill} className={`rounded-xl border p-2.5 ${skill === primarySkill ? 'border-[rgba(211,255,81,0.2)] bg-[rgba(211,255,81,0.055)]' : 'border-white/[0.07] bg-black/20'}`}>
              <p className="truncate text-[8px] font-black uppercase tracking-[0.11em] text-white/28">{SKILL_LABELS[skill]}</p>
              <p className={`mt-1 text-sm font-black ${skill === primarySkill ? 'text-[var(--accent)]' : 'text-white/70'}`}>{member.skills[skill]}</p>
            </div>
          ))}
        </div>

        {member.bonuses.length > 0 ? (
          <div className="mt-3 space-y-2">
            {member.bonuses.map((bonus) => (
              <div key={bonus.id} className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
                <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black text-white/72">{bonus.label}</p><span className="text-[9px] font-black text-[var(--accent)]">+{bonus.value}</span></div>
                <p className="mt-1 text-[9px] leading-4 text-white/30">{bonus.description}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" disabled={disabled || member.loyalty >= 100} onClick={() => onSupport(member)} className="rounded-xl border border-emerald-300/15 bg-emerald-400/[0.055] px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-100/80 disabled:opacity-30">Buy support</button>
          <button type="button" disabled={disabled} onClick={() => onDismiss(member)} className="rounded-xl border border-red-400/15 bg-red-500/[0.045] px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-red-100/70 disabled:opacity-35">Dismiss member</button>
        </div>
      </div>
    </article>
  );
}

function StatPill({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warning' | 'danger' }) {
  const toneClass = tone === 'danger' ? 'text-red-200' : tone === 'warning' ? 'text-amber-200' : 'text-white/75';
  return <div className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5"><p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/25">{label}</p><p className={`mt-1 truncate text-xs font-black ${toneClass}`}>{value}</p></div>;
}

function statusClass(status: GangMember['status']) {
  if (status === 'INJURED') return 'border-red-300/20 bg-red-400/[0.08] text-red-100';
  if (status === 'WORKING') return 'border-emerald-300/20 bg-emerald-400/[0.08] text-emerald-100';
  return 'border-white/10 bg-white/[0.035] text-white/40';
}

function formatWork(value: string | null) {
  if (!value) return 'None';
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()).slice(0, 24);
}
