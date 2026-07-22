import { useState } from 'react';
import { GANG_SKILL_DEFINITIONS } from '../../lib/gangMemberDefinitions';
import {
  GANG_MEMBER_SKILLS,
  RARITY_LABELS,
  RARITY_STYLES,
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
  const [expanded, setExpanded] = useState(false);
  const primarySkill = getPrimarySkill(member);
  const xpNeeded = memberXpForNextLevel(member.level);
  const xpPercent = member.level >= 50 ? 100 : Math.min(100, Math.round((member.xp / xpNeeded) * 100));
  const initials = `${member.firstName.slice(0, 1)}${member.nickname.slice(0, 1)}`.toUpperCase();
  const injuryHours = Math.max(0, Math.ceil(member.injuredUntilGameHour - currentGameHour));
  const status = injuryHours > 0 ? 'INJURED' : member.status;

  return (
    <article className={`flex h-full flex-col overflow-hidden rounded-[22px] border ${RARITY_STYLES[member.rarity]}`}>
      <div className="flex-1 p-4">
        <div className="flex items-start gap-3">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30 text-sm font-black text-white">
            <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.14),transparent_45%)]" />
            <span className="relative">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-current/20 bg-black/20 px-2 py-1 text-[7px] font-black uppercase tracking-[0.13em]">{RARITY_LABELS[member.rarity]}</span>
              <span className={`rounded-full border px-2 py-1 text-[7px] font-black uppercase tracking-[0.13em] ${statusClass(status)}`}>{status === 'INJURED' ? `${injuryHours}h injured` : status === 'WORKING' ? 'Working' : 'Available'}</span>
            </div>
            <h3 className="mt-2 truncate text-sm font-black tracking-[-0.02em] text-white">{member.displayName}</h3>
            <p className="mt-1 text-[9px] font-black uppercase tracking-[0.11em] text-white/32">{getMemberRole(member)} · Level {member.level}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <QuickStat label="Loyalty" value={`${member.loyalty}%`} tone={member.loyalty < 40 ? 'danger' : member.loyalty < 70 ? 'warning' : 'normal'} />
          <QuickStat label="Primary skill" value={`${GANG_SKILL_DEFINITIONS[primarySkill].label} ${member.skills[primarySkill]}`} />
          <QuickStat label="Last work" value={formatWork(member.lastWorkType)} />
          <QuickStat label="Fatigue" value={`${member.consecutiveWorkRuns}/2`} tone={member.consecutiveWorkRuns > 0 ? 'warning' : 'normal'} />
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-[0.1em] text-white/28"><span>Member XP</span><span>{member.level >= 50 ? 'MAX' : `${member.xp} / ${xpNeeded}`}</span></div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${xpPercent}%` }} /></div>
        </div>

        <button type="button" onClick={() => setExpanded((value) => !value)} className="btn-ghost mt-4 w-full rounded-xl px-3 py-2.5 text-[9px]">
          {expanded ? 'Hide details' : 'View skills and bonuses'}
        </button>

        {expanded ? (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {GANG_MEMBER_SKILLS.map((skill) => (
                <div key={skill} className={`rounded-xl border px-3 py-2.5 ${skill === primarySkill ? 'border-[rgba(211,255,81,0.22)] bg-[rgba(211,255,81,0.055)]' : 'border-white/[0.07] bg-black/20'}`}>
                  <p className="truncate text-[7px] font-black uppercase tracking-[0.1em] text-white/25">{GANG_SKILL_DEFINITIONS[skill].label}</p>
                  <p className={`mt-1 text-sm font-black ${skill === primarySkill ? 'text-[var(--accent)]' : 'text-white/70'}`}>{member.skills[skill]}</p>
                </div>
              ))}
            </div>
            {member.bonuses.map((bonus) => (
              <div key={bonus.id} className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-3">
                <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black text-white/72">{bonus.label}</p><span className="text-[9px] font-black text-[var(--accent)]">+{bonus.value}</span></div>
                <p className="mt-1 text-[9px] leading-4 text-white/32">{GANG_SKILL_DEFINITIONS[bonus.skill].description}</p>
              </div>
            ))}
            {member.bonuses.length === 0 ? <p className="rounded-xl border border-dashed border-white/[0.08] px-3 py-4 text-center text-[9px] font-bold text-white/25">No member bonuses</p> : null}
          </div>
        ) : null}
      </div>

      <div className="mt-auto grid gap-2 border-t border-white/[0.07] bg-black/15 p-4 sm:grid-cols-2">
        <button type="button" disabled={disabled || member.loyalty >= 100} onClick={() => onSupport(member)} className="rounded-xl border border-emerald-300/15 bg-emerald-400/[0.05] px-3 py-2.5 text-[9px] font-black uppercase tracking-[0.1em] text-emerald-100/80 disabled:opacity-30">Buy support</button>
        <button type="button" disabled={disabled} onClick={() => onDismiss(member)} className="rounded-xl border border-red-400/15 bg-red-500/[0.04] px-3 py-2.5 text-[9px] font-black uppercase tracking-[0.1em] text-red-100/75 disabled:opacity-30">Dismiss member</button>
      </div>
    </article>
  );
}

function QuickStat({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warning' | 'danger' }) {
  const valueClass = tone === 'danger' ? 'text-red-200' : tone === 'warning' ? 'text-amber-200' : 'text-white/72';
  return <div className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5"><p className="text-[7px] font-black uppercase tracking-[0.1em] text-white/24">{label}</p><p className={`mt-1 truncate text-[10px] font-black ${valueClass}`}>{value}</p></div>;
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
