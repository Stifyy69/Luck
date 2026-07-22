import type { GangMember } from '../../types/gang';

const skillLabels = { shooting: 'Shooting', tactics: 'Tactics', leadership: 'Leadership', streetSmart: 'Street Smart', farming: 'Farming', recruiting: 'Recruiting' } as const;
const primaryByRole = { Shooter: 'shooting', Farmer: 'farming', Strategist: 'tactics', Recruiter: 'recruiting', Leader: 'leadership', 'Street Fixer': 'streetSmart' } as const;

export default function GangMemberCard({ member }: { member: GangMember }) {
  const primary = primaryByRole[member.role];
  const injury = member.status === 'Injured' && member.injuryUntil ? new Date(member.injuryUntil).toLocaleString('ro-RO') : null;
  return (
    <article className="flex h-full flex-col rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-300/40 to-violet-500/40 font-black">{member.displayName.slice(0, 1)}</div><div className="min-w-0 flex-1"><h3 className="truncate font-black">{member.displayName}</h3><p className="text-xs text-white/45">{member.nickname} · Level {member.level} · {member.role}</p></div><div className="text-right"><p className="text-[10px] font-black uppercase text-amber-200">{member.rarity}</p><p className="mt-1 text-[10px] text-white/50">{member.status}</p></div></div>
      <div className="mt-4"><div className="flex justify-between text-[11px] text-white/50"><span>XP {member.xp}/{member.xpNeeded}</span><span>Loyalty {member.loyalty}%</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-violet-400" style={{ width: `${Math.min(100, member.xp / member.xpNeeded * 100)}%` }} /></div></div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]"><Quick label="Primary" value={skillLabels[primary]} /><Quick label="Last Work" value={member.lastWork || 'None'} /><Quick label="Fatigue" value={member.fatigue ? `${member.fatigue.activity} ${member.fatigue.count}/2` : 'None'} /></div>
      {injury ? <p className="mt-2 rounded-lg bg-rose-500/10 p-2 text-xs text-rose-200">Recovery: {injury}</p> : null}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{Object.entries(member.skills).map(([key, value]) => <div key={key} className={`rounded-lg border px-2 py-2 ${key === primary ? 'border-amber-300/40 bg-amber-400/10' : 'border-white/5 bg-white/[0.03]'}`}><p className="text-[9px] uppercase text-white/40">{skillLabels[key as keyof typeof skillLabels]}</p><p className="font-black">{value}</p></div>)}</div>
      {member.bonuses?.length ? <div className="mt-3 flex flex-wrap gap-1">{member.bonuses.map((bonus) => <span key={bonus} className="rounded-full bg-cyan-400/10 px-2 py-1 text-[10px] text-cyan-100">{bonus}</span>)}</div> : null}
      <div className="mt-auto grid grid-cols-2 gap-2 pt-4"><button className="rounded-lg bg-emerald-500/70 px-2 py-2 text-xs font-black">Buy Support</button><button className="rounded-lg bg-rose-500/20 px-2 py-2 text-xs font-black text-rose-100">Dismiss Member</button></div>
    </article>
  );
}

function Quick({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-white/5 p-2"><p className="text-white/35">{label}</p><p className="mt-1 truncate font-bold">{value}</p></div>; }
