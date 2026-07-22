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
  const stage = battle.stages[Math.min(battle.stageIndex, battle.stages.length - 1)];
  const complete = Boolean(battle.result);
  return (
    <div className="fixed inset-0 z-[128] flex items-center justify-center bg-black/85 px-4 backdrop-blur-md">
      <div className="game-panel w-full max-w-5xl overflow-hidden p-5 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div className="rounded-[24px] border border-red-300/12 bg-red-500/[0.035] p-5">
            <p className="text-[9px] font-black uppercase tracking-[0.19em] text-red-100/55">Gang battle</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white">VS {battle.opponentName}</h2>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <ScoreCard label="Your Gang" value={complete ? battle.result?.playerStageWins || 0 : battle.stages.slice(0, battle.stageIndex + 1).filter((entry) => entry.winner === 'PLAYER').length} />
              <ScoreCard label={battle.opponentName} value={complete ? battle.result?.opponentStageWins || 0 : battle.stages.slice(0, battle.stageIndex + 1).filter((entry) => entry.winner === 'OPPONENT').length} />
            </div>
            {complete && battle.result ? (
              <div className={`mt-4 rounded-xl border px-4 py-4 text-center ${battle.result.won ? 'border-emerald-300/15 bg-emerald-400/[0.05]' : 'border-red-300/15 bg-red-400/[0.05]'}`}>
                <p className={`text-2xl font-black ${battle.result.won ? 'text-emerald-100' : 'text-red-100'}`}>{battle.result.won ? 'VICTORY' : 'DEFEAT'}</p>
              </div>
            ) : null}
          </div>

          <div>
            <p className="section-kicker">{complete ? 'Battle complete' : `Stage ${battle.stageIndex + 1} / ${battle.stages.length}`}</p>
            <h3 className="mt-2 text-4xl font-black tracking-[-0.05em] text-white">{complete ? `${battle.result?.playerStageWins}-${battle.result?.opponentStageWins}` : stage?.label || 'Preparing'}</h3>
            <div className="mt-6 rounded-[20px] border border-white/[0.08] bg-black/20 p-5">
              <p className="text-xl font-black text-white">{complete ? finalText(battle.result) : stage?.eventText}</p>
              {!complete && stage ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <MiniScore label="Your score" value={stage.playerScore} won={stage.winner === 'PLAYER'} />
                  <MiniScore label="Enemy score" value={stage.opponentScore} won={stage.winner === 'OPPONENT'} />
                </div>
              ) : null}
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs"><span className="font-bold text-white/40">Battle progress</span><span className="font-black text-[var(--accent)]">{Math.round(Math.max(0, Math.min(100, battle.progress)))}%</span></div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, battle.progress))}%` }} /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4 text-center"><p className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-white/28">{label}</p><p className="mt-2 text-4xl font-black text-white">{value}</p></div>;
}

function MiniScore({ label, value, won }: { label: string; value: number; won: boolean }) {
  return <div className={`rounded-xl border p-3 ${won ? 'border-emerald-300/15 bg-emerald-400/[0.045]' : 'border-white/[0.07] bg-black/20'}`}><p className="text-[8px] font-black uppercase tracking-[0.11em] text-white/25">{label}</p><p className={`mt-1 text-lg font-black ${won ? 'text-emerald-100' : 'text-white/65'}`}>{value.toFixed(1)}</p></div>;
}

function finalText(result: GangBattleResult | null) {
  if (!result) return '';
  const injuryText = result.injuries.length > 0 ? `${result.injuries.length} injured.` : 'No injuries.';
  if (!result.won) return `Battle lost. ${injuryText}`;
  return `+${result.dirtyReward.toLocaleString('en-US')} dirty, +${result.reputationReward} reputation. ${injuryText}`;
}
