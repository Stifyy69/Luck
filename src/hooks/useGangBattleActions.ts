import type { Dispatch, SetStateAction } from 'react';
import type { GangBattleOverlayState } from '../components/gangs/GangBattleOverlay';
import { appendLog, applyRemoteGangData, wait } from '../lib/gangLocalState';
import { addMemberLoyalty, awardMemberActivity, type GangMember } from '../lib/gangMembers';
import { type GangBotOpponent } from '../lib/gangBattles';
import type { GangData } from '../lib/gangState';
import { performGangBattle } from '../lib/platformApi';

type Options = {
  busy: boolean; members: GangMember[]; gangData: GangData; currentGameHour: number;
  setBusy: Dispatch<SetStateAction<boolean>>; setGangData: Dispatch<SetStateAction<GangData>>;
  setTimeFarm: Dispatch<SetStateAction<number>>; setBattleOverlay: Dispatch<SetStateAction<GangBattleOverlayState | null>>;
  pushPopup: (text: string) => void;
  playerId: string | null;
};

function operationId() {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '') : `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  return `battle_${random}`;
}

export function useGangBattleActions(o: Options) {
  const startBattle = (opponent: GangBotOpponent, ids: string[], leaderId: string) => {
    if (o.busy || !o.playerId) return;
    const crew = ids.map((id) => o.members.find((m) => m.id === id)).filter((m): m is GangMember => Boolean(m)).slice(0, 5);
    if (!crew.length || !crew.some((m) => m.id === leaderId)) return;
    o.setBusy(true);
    void (async () => {
      try {
        const response = await performGangBattle(o.playerId!, opponent, ids, leaderId, operationId());
        const result = response.result;
        o.setBattleOverlay({ opponentName: opponent.name, stageIndex: 0, progress: 0, stages: result.stages, result: null });
        for (let i = 0; i < result.stages.length; i += 1) {
          o.setBattleOverlay((v) => v ? { ...v, stageIndex: i, progress: Math.round(((i + 1) / (result.stages.length + 1)) * 100) } : v);
          await wait(950);
        }
        o.setBattleOverlay((v) => v ? { ...v, progress: 100, result } : v);
        o.setGangData((current) => {
          const remote = applyRemoteGangData(current, response.gang);
          let members = awardMemberActivity(remote.members, ids, { primary: 'shooting', secondary: 'tactics', leaderId, leaderPrimary: 'leadership', leaderSecondary: 'tactics', leaderXpBonus: 10 }, result.xpGain);
          if (result.loyaltyGain) members = addMemberLoyalty(members, ids, result.loyaltyGain);
          const recoveryStart = o.currentGameHour + 1;
          members = members.map((m) => {
            const injury = result.injuries.find((entry) => entry.memberId === m.id);
            return injury ? { ...m, injuredUntilGameHour: recoveryStart + injury.recoveryHours, status: 'INJURED' as const } : m;
          });
          return appendLog({ ...remote, members }, `${result.won ? 'Battle won' : 'Battle lost'} vs ${opponent.name}, ${result.playerStageWins}-${result.opponentStageWins}.`, result.won ? 'positive' : 'negative');
        });
        o.setTimeFarm((v) => v + 1); await wait(1400);
        o.pushPopup(result.won ? `Victory ${result.playerStageWins}-${result.opponentStageWins}` : `Defeat ${result.playerStageWins}-${result.opponentStageWins}`);
      } catch (error) {
        o.pushPopup(error instanceof Error ? error.message : 'Gang battle failed.');
      } finally { o.setBattleOverlay(null); o.setBusy(false); }
    })();
  };

  const saveDefensiveCrew = (ids: string[]) => {
    const valid = ids.filter((id) => o.members.some((m) => m.id === id)).slice(0, 5);
    if (!valid.length) return;
    o.setGangData((v) => appendLog({ ...v, defensiveCrewIds: valid }, 'Defensive crew saved.', 'positive'));
    o.pushPopup('Defensive crew saved.');
  };

  const treatMember = (id: string) => {
    const member = o.gangData.members.find((m) => m.id === id);
    if (!member || member.injuredUntilGameHour <= o.currentGameHour) return;
    const cost = Math.max(1, Math.ceil(member.injuredUntilGameHour - o.currentGameHour)) * 75_000;
    if (o.gangData.cleanBalance < cost) return o.pushPopup('Not enough Gang clean cash.');
    o.setGangData((v) => appendLog({ ...v, cleanBalance: v.cleanBalance - cost, members: v.members.map((m) => m.id === id ? { ...m, injuredUntilGameHour: 0, status: 'AVAILABLE' as const } : m) }, `${member.displayName} treated for ${cost.toLocaleString('en-US')} clean.`, 'positive'));
    o.pushPopup(`${member.displayName} recovered.`);
  };
  return { startBattle, saveDefensiveCrew, treatMember };
}
