import type { GangBattleResult, GangBattleStageResult } from '../../lib/gangBattles';

export type GangBattleOverlayState = {
  opponentName: string;
  stageIndex: number;
  progress: number;
  stages: GangBattleStageResult[];
  result: GangBattleResult | null;
};

export default function GangBattleOverlay({ battle }: { battle: GangBattleOverlayState | null }) {
  if (!battle) return null;
  const complete = Boolean(battle.result);
  const stage = battle.stages[Math.min(battle.stageIndex, battle.stages.length - 1)];
  const playerWins = complete ? battle.result?.playerStageWins || 0 : battle.stages.slice(0, battle.stageIndex + 1).filter((entry) => entry.winner === 'PLAYER').length;
  const enemyWins = complete ? battle.result?.opponentStageWins || 0 : battle.stages.slice(0, battle.stageIndex + 1).filter((entry) => entry.winner === 'OPPONENT').length;
  return (
    <div className="fixed inset-0 z-[128] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div className="game-panel w-full max-w-2xl p-5 sm:p-6">
        <p className="section-kicker">{complete ? 'Battle complete' : `Stage ${battle.stageIndex + 1} of ${battle.stages.length}`}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-black tracking-[-0.04em] text-white">Your Gang vs {battle.opponentName}</h2><span className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-sm font-black text-white">{playerWins} - {enemyWins}</span></div>
        <div className={`mt-5 rounded-[18px] border p-5 ${complete && battle.result?.won ? 'border-emerald-300/15 bg-emerald-400/[0.045]' : complete ? 'border-red-300/15 bg-red-400/[0.04]' : 'border-white/[0.08] bg-black/20'}`}>
          <p className="text-[8px] font-black uppercase tracking-[0.11em] text-white/28">{complete ? (battle.result?.won ? 'Victory' : 'Defeat') : stage?.label || 'Preparing'}</p>
          <p className="mt-2 text-xl font-black text-white">{complete ? finalText(battle.result) : stage?.eventText}</p>
          {!complete && stage ? <div className="mt-4 grid grid-cols-2 gap-2"><Score label="Your score" value={stage.playerScore} active={stage.winner === 'PLAYER'} /><Score label="Enemy score" value={stage.opponentScore} active={stage.winner === 'OPPONENT'} /></div> : null}
        </div>
        <div className="mt-5"><div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.1em] text-white/30"><span>Battle progress</span><span>{Math.round(Math.max(0, Math.min(100, battle.progress)))}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(0, Math.min(100, battle.progress))}%` }} /></div></div>
      </div>
    </div>
  );
}

function Score({ label, value, active }: { label: string; value: number; active: boolean }) { return <div className={`rounded-xl border px-3 py-3 ${active ? 'border-emerald-300/15 bg-emerald-400/[0.04]' : 'border-white/[0.07] bg-black/20'}`}><p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/25">{label}</p><p className={`mt-1 text-lg font-black ${active ? 'text-emerald-100' : 'text-white/65'}`}>{value.toFixed(1)}</p></div>; }
function finalText(result: GangBattleResult | null) { if (!result) return ''; const injury = result.injuries.length ? `${result.injuries.length} injured.` : 'No injuries.'; return result.won ? `+${result.dirtyReward.toLocaleString('en-US')} dirty, +${result.reputationReward} reputation. ${injury}` : `Battle lost. ${injury}`; }
