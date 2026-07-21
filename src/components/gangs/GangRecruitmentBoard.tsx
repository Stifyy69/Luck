import {
  GANG_MEMBER_SKILLS,
  RARITY_LABELS,
  RARITY_STYLES,
  SKILL_LABELS,
  getMemberRole,
  getPrimarySkill,
  type GangMember,
} from '../../lib/gangMembers';

export default function GangRecruitmentBoard({
  candidates,
  recruitingCandidateId,
  recruitTimer,
  disabled,
  isFull,
  onRecruit,
}: {
  candidates: GangMember[];
  recruitingCandidateId: string | null;
  recruitTimer: number;
  disabled: boolean;
  isFull: boolean;
  onRecruit: (candidateId: string) => void;
}) {
  return (
    <section className="rounded-[24px] border border-white/[0.08] bg-black/25 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--accent)]/70">Recruitment board</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">Choose the next member</h2>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-white/38">
            Recruitment is free. Existing Recruiting skill improves candidate quality. Mythic members never appear here and remain admin or event exclusive.
          </p>
        </div>
        <span className="w-fit rounded-full border border-emerald-300/15 bg-emerald-400/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.13em] text-emerald-100/80">
          Free recruitment
        </span>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        {candidates.map((candidate) => {
          const primarySkill = getPrimarySkill(candidate);
          const busy = recruitingCandidateId === candidate.id;
          return (
            <article key={candidate.id} className={`rounded-[20px] border p-4 ${RARITY_STYLES[candidate.rarity]}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="rounded-full border border-current/20 bg-black/20 px-2 py-1 text-[8px] font-black uppercase tracking-[0.14em]">
                    {RARITY_LABELS[candidate.rarity]}
                  </span>
                  <h3 className="mt-3 truncate text-sm font-black text-white">{candidate.displayName}</h3>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-white/32">
                    {getMemberRole(candidate)} · Loyalty {candidate.loyalty}%
                  </p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-xs font-black text-white">
                  {candidate.firstName.slice(0, 1)}{candidate.nickname.slice(0, 1)}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-1.5">
                {GANG_MEMBER_SKILLS.map((skill) => (
                  <div key={skill} className={`rounded-lg border px-2 py-2 ${skill === primarySkill ? 'border-[rgba(211,255,81,0.2)] bg-[rgba(211,255,81,0.05)]' : 'border-white/[0.06] bg-black/15'}`}>
                    <p className="truncate text-[7px] font-black uppercase tracking-[0.09em] text-white/24">{SKILL_LABELS[skill]}</p>
                    <p className={`mt-0.5 text-xs font-black ${skill === primarySkill ? 'text-[var(--accent)]' : 'text-white/62'}`}>{candidate.skills[skill]}</p>
                  </div>
                ))}
              </div>

              {candidate.bonuses[0] ? (
                <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5">
                  <p className="text-[9px] font-black text-white/70">{candidate.bonuses[0].label}</p>
                  <p className="mt-1 text-[8px] leading-4 text-white/28">{candidate.bonuses[0].description}</p>
                </div>
              ) : null}

              <button
                type="button"
                disabled={disabled || isFull || Boolean(recruitingCandidateId)}
                onClick={() => onRecruit(candidate.id)}
                className="btn-primary mt-4 w-full rounded-xl px-3 py-2.5 text-[10px] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? `Recruiting ${recruitTimer}s` : isFull ? 'Member limit reached' : 'Recruit free'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
