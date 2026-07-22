import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GangActivityOverlayState } from '../components/gangs/GangActivityOverlay';
import type { GangBattleOverlayState } from '../components/gangs/GangBattleOverlay';
import { LOYALTY_SUPPORT_OPTIONS } from '../components/gangs/GangLoyaltySupportModal';
import { createGangActivityLog } from '../lib/gangActivity';
import { api } from '../lib/api';
import { generateBotOpponents } from '../lib/gangBattles';
import {
  awardMemberActivity,
  createRecruitmentBoard,
  createStarterMembers,
  dismissGangMember,
  getAvailableGangMembers,
  getRecruitingPower,
  recoverMembersByGameTime,
  restoreMemberLoyalty,
  type GangMember,
} from '../lib/gangMembers';
import { appendLog, applyRemoteGangData, buildInitialGangData, loadGameState, saveGameState, wait } from '../lib/gangLocalState';
import { canAffordGangUpgrade, getGangLevel, getGangUpgradeCost } from '../lib/gangProgression';
import type { GangData } from '../lib/gangState';
import { GANG_WORK_LABELS, GANG_WORK_STAGES, gangStockValue, type GangWorkType } from '../lib/gangWork';
import { createGangState, syncGangState, upgradeGangState } from '../lib/platformApi';
import { usePlayer } from './usePlayer';
import { useGangBattleActions } from './useGangBattleActions';
import { useGangWorkActions } from './useGangWorkActions';

type Support = (typeof LOYALTY_SUPPORT_OPTIONS)[number];

function navigate(path: string) {
  if (location.pathname === path) return;
  history.pushState({}, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
}

export function useGangController() {
  const { playerId, player } = usePlayer();
  const saved = typeof window === 'undefined' ? null : loadGameState();
  const [gangNameInput, setGangNameInput] = useState('');
  const [popup, setPopup] = useState<string | null>(null);
  const [activity, setActivity] = useState<GangActivityOverlayState | null>(null);
  const [battleOverlay, setBattleOverlay] = useState<GangBattleOverlayState | null>(null);
  const [recruitTimer, setRecruitTimer] = useState(0);
  const [recruitingCandidate, setRecruitingCandidate] = useState<GangMember | null>(null);
  const [dismissTarget, setDismissTarget] = useState<GangMember | null>(null);
  const [supportTarget, setSupportTarget] = useState<GangMember | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [activityBusy, setActivityBusy] = useState(false);
  const [cashBalance, setCashBalance] = useState(Number(saved?.cashBalance ?? saved?.baniCurati ?? 1_000_000));
  const [baniMurdari, setBaniMurdari] = useState(Number(saved?.baniMurdari ?? 0));
  const [timeFarm, setTimeFarm] = useState(Number(saved?.timeFarm ?? 0));
  const [gangData, setGangData] = useState<GangData>(() => buildInitialGangData(saved));
  const [transportMembers, setTransportMembers] = useState(1);

  const formed = Boolean(gangData.name);
  const level = getGangLevel(gangData.levelIndex);
  const maxMembers = level.maxMembers;
  const currentGameHour = Math.max(0, timeFarm);
  const availableMembers = useMemo(() => getAvailableGangMembers(gangData.members, currentGameHour), [gangData.members, currentGameHour]);
  const averageLoyalty = useMemo(() => gangData.members.length ? Math.round(gangData.members.reduce((sum, member) => sum + member.loyalty, 0) / gangData.members.length) : 0, [gangData.members]);
  const recruitingPower = useMemo(() => getRecruitingPower(gangData.members), [gangData.members]);
  const upgradeCost = getGangUpgradeCost(gangData.levelIndex);
  const canUpgrade = canAffordGangUpgrade(upgradeCost, gangData);
  const stockValue = gangStockValue(gangData);
  const opponents = useMemo(() => generateBotOpponents(gangData.levelIndex, gangData.battleBoardSeed), [gangData.levelIndex, gangData.battleBoardSeed]);
  const isFull = gangData.members.length >= maxMembers;
  const pushPopup = useCallback((text: string) => {
    setPopup(text);
    window.setTimeout(() => setPopup(null), 2800);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setRecruitTimer((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (player) setCashBalance(Number(player.cleanMoney || 0));
  }, [player]);

  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    api.cayoState(playerId)
      .then(({ state }) => { if (!cancelled) setBaniMurdari(Number(state.dirtyMoney || 0)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [playerId]);

  useEffect(() => {
    const current = loadGameState() || {};
    saveGameState({ ...current, cashBalance, baniCurati: cashBalance, baniMurdari, timeFarm, gangData });
    window.dispatchEvent(new Event('cityflow-gang-local-change'));
  }, [gangData, cashBalance, baniMurdari, timeFarm]);

  useEffect(() => {
    const reload = () => {
      const latest = loadGameState();
      if (!latest?.gangData) return;
      setGangData((current) => applyRemoteGangData(current, latest.gangData));
      setCashBalance(Number(latest.cashBalance ?? latest.baniCurati ?? 0));
      setBaniMurdari(Number(latest.baniMurdari ?? 0));
      setTimeFarm(Number(latest.timeFarm ?? 0));
    };
    window.addEventListener('cityflow-gang-updated', reload);
    return () => window.removeEventListener('cityflow-gang-updated', reload);
  }, []);

  useEffect(() => {
    setTransportMembers((value) => Math.max(1, Math.min(value, Math.max(1, availableMembers.length))));
    setGangData((current) => {
      const members = recoverMembersByGameTime(current.members, currentGameHour);
      const recruitmentBoard = members.length >= maxMembers ? [] : current.recruitmentBoard.length >= 3 ? current.recruitmentBoard.slice(0, 3) : createRecruitmentBoard(members, 3);
      return { ...current, members, recruitmentBoard };
    });
  }, [currentGameHour, maxMembers, availableMembers.length]);

  useEffect(() => {
    if (!recruitingCandidate || recruitTimer > 0) return;
    const candidate = recruitingCandidate;
    setGangData((current) => {
      if (current.members.length >= maxMembers || !current.recruitmentBoard.some((member) => member.id === candidate.id)) return current;
      const recruiter = [...current.members].sort((left, right) => right.skills.recruiting - left.skills.recruiting)[0];
      const rewarded = recruiter ? awardMemberActivity(current.members, [recruiter.id], { primary: 'recruiting', secondary: 'leadership' }, 14) : current.members;
      const members = [...rewarded, { ...candidate, joinedAt: Date.now(), status: 'AVAILABLE' as const }];
      const replacement = createRecruitmentBoard(members, 1)[0];
      const recruitmentBoard = members.length >= maxMembers ? [] : current.recruitmentBoard.map((member) => member.id === candidate.id ? replacement : member).filter((member): member is GangMember => Boolean(member));
      return appendLog({ ...current, members, recruitmentBoard }, `${candidate.displayName} joined the gang.`, 'positive');
    });
    setRecruitingCandidate(null);
    pushPopup(`${candidate.displayName} joined the gang.`);
  }, [recruitTimer, recruitingCandidate, maxMembers, pushPopup]);

  const formGang = async () => {
    if (formed || activityBusy || !playerId) return;
    if (!gangNameInput.trim()) return pushPopup('Set a gang name.');
    const members = createStarterMembers(4);
    setActivityBusy(true);
    try {
      const result = await createGangState(playerId, gangNameInput.trim().slice(0, 48), members);
      setBaniMurdari(result.playerDirtyMoney);
      setGangData((current) => applyRemoteGangData({ ...current, recruitmentBoard: createRecruitmentBoard(members, 3), activityLog: [createGangActivityLog('Gang created.', 'positive')] }, result.gang));
      window.dispatchEvent(new Event('cityflow-player-refresh'));
      pushPopup('Gang created.');
    } catch (error) {
      pushPopup(error instanceof Error ? error.message : 'Gang creation failed.');
    } finally {
      setActivityBusy(false);
    }
  };

  const startRecruit = (id: string) => {
    if (activityBusy || recruitingCandidate || isFull) return;
    const candidate = gangData.recruitmentBoard.find((member) => member.id === id);
    if (candidate) {
      setRecruitingCandidate(candidate);
      setRecruitTimer(5 + Math.floor(Math.random() * 6));
    }
  };

  const confirmDismiss = () => {
    if (!dismissTarget || activityBusy) return;
    const result = dismissGangMember(gangData.members, dismissTarget.id, gangData.dismissalPressure, gangData.lastDismissalAt);
    setGangData((current) => appendLog({
      ...current,
      members: result.members,
      dismissalPressure: result.pressure,
      lastDismissalAt: result.lastDismissalAt,
      defensiveCrewIds: current.defensiveCrewIds.filter((id) => id !== result.dismissed?.id),
      removedEventMemberIds: result.dismissed?.source === 'ADMIN_EVENT' ? [...current.removedEventMemberIds, result.dismissed.id].slice(-100) : current.removedEventMemberIds,
      recruitmentBoard: result.members.length >= maxMembers ? [] : createRecruitmentBoard(result.members, 3),
    }, `${result.dismissed?.displayName} dismissed. -${result.loyaltyLoss}% loyalty.`, 'negative'));
    setDismissTarget(null);
    pushPopup(`Loyalty decreased by ${result.loyaltyLoss}%.`);
  };

  const buyLoyaltySupport = (option: Support) => {
    if (!supportTarget || activityBusy || gangData.cleanBalance < option.cost) return;
    setGangData((current) => appendLog({ ...current, cleanBalance: current.cleanBalance - option.cost, members: restoreMemberLoyalty(current.members, supportTarget.id, option.loyalty) }, `${supportTarget.displayName}: ${option.label}, +${option.loyalty}% loyalty.`, 'positive'));
    setSupportTarget(null);
    pushPopup(`+${option.loyalty}% loyalty`);
  };

  const confirmUpgrade = async () => {
    if (!upgradeCost || !canUpgrade || activityBusy || !playerId) return;
    setActivityBusy(true);
    try {
      await syncGangState(playerId, gangData);
      const remote = await upgradeGangState(playerId);
      const next = applyRemoteGangData(gangData, remote);
      setGangData(next);
      setUpgradeOpen(false);
      pushPopup(`Gang upgraded to ${getGangLevel(next.levelIndex).name}.`);
    } catch (error) {
      pushPopup(error instanceof Error ? error.message : 'Gang upgrade failed.');
    } finally {
      setActivityBusy(false);
    }
  };

  const runActivityPresentation = async (type: GangWorkType, participants: number, complete: () => Promise<string> | string) => {
    const labels = GANG_WORK_LABELS[type];
    const stages = GANG_WORK_STAGES[type];
    setActivityBusy(true);
    setActivity({ ...labels, stages, stageIndex: 0, progress: 0, participants });
    try {
      for (let index = 0; index < stages.length; index += 1) {
        setActivity((current) => current ? { ...current, stageIndex: index, progress: Math.round((index / stages.length) * 90) } : current);
        await wait(650);
      }
      const resultText = await complete();
      setActivity((current) => current ? { ...current, progress: 100, resultText } : current);
      await wait(1000);
    } finally {
      setActivity(null);
      setActivityBusy(false);
    }
  };

  const work = useGangWorkActions({ busy: activityBusy, availableMembers, gangData, maxMembers, timeFarm, transportMembers, cashBalance, baniMurdari, setGangData, setTimeFarm, setCashBalance, setBaniMurdari, runActivityPresentation, pushPopup, playerId });
  const battle = useGangBattleActions({ busy: activityBusy || work.economyBusy, members: availableMembers, gangData, currentGameHour, setBusy: setActivityBusy, setGangData, setTimeFarm, setBattleOverlay, pushPopup, playerId });
  const busy = activityBusy || work.economyBusy;

  return {
    activity, averageLoyalty, availableMembers, baniMurdari, battleOverlay, busy, buyLoyaltySupport, canUpgrade, cashBalance,
    confirmDismiss, confirmUpgrade, currentGameHour, dismissTarget, formGang, formed, gangData, gangNameInput, isFull, level,
    maxMembers, opponents, popup, recruitingCandidate, recruitingPower, recruitTimer, setDismissTarget, setGangData, setGangNameInput,
    setSupportTarget, setTransportMembers, setUpgradeOpen, stockValue, supportTarget, timeFarm, transportMembers, upgradeCost,
    upgradeOpen, startRecruit, ...work, ...battle, openBattles: () => navigate('/gangs/battles'),
    refreshOpponents: () => setGangData((current) => ({ ...current, battleBoardSeed: current.battleBoardSeed + 1 })),
  };
}
