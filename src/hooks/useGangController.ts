import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GangActivityOverlayState } from '../components/gangs/GangActivityOverlay';
import type { GangBattleOverlayState } from '../components/gangs/GangBattleOverlay';
import { LOYALTY_SUPPORT_OPTIONS } from '../components/gangs/GangLoyaltySupportModal';
import { createGangActivityLog } from '../lib/gangActivity';
import { generateBotOpponents } from '../lib/gangBattles';
import { awardMemberActivity, createRecruitmentBoard, createStarterMembers, dismissGangMember, getAvailableGangMembers, getRecruitingPower, recoverMembersByGameTime, restoreMemberLoyalty, type GangMember } from '../lib/gangMembers';
import { appendLog, applyRemoteGangData, buildInitialGangData, loadGameState, saveGameState, wait } from '../lib/gangLocalState';
import { canAffordGangUpgrade, getGangLevel, getGangUpgradeCost } from '../lib/gangProgression';
import type { GangData } from '../lib/gangState';
import { GANG_WORK_LABELS, GANG_WORK_STAGES, gangStockValue, type GangWorkType } from '../lib/gangWork';
import { syncGangState, upgradeGangState } from '../lib/platformApi';
import { usePlayer } from './usePlayer';
import { useGangBattleActions } from './useGangBattleActions';
import { useGangWorkActions } from './useGangWorkActions';

type Support = (typeof LOYALTY_SUPPORT_OPTIONS)[number];
function navigate(path: string) { if (location.pathname !== path) { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); } }

export function useGangController() {
  const { playerId } = usePlayer(); const saved = typeof window === 'undefined' ? null : loadGameState();
  const [gangNameInput, setGangNameInput] = useState(''); const [popup, setPopup] = useState<string | null>(null);
  const [activity, setActivity] = useState<GangActivityOverlayState | null>(null); const [battleOverlay, setBattleOverlay] = useState<GangBattleOverlayState | null>(null);
  const [recruitTimer, setRecruitTimer] = useState(0); const [recruitingCandidate, setRecruitingCandidate] = useState<GangMember | null>(null);
  const [dismissTarget, setDismissTarget] = useState<GangMember | null>(null); const [supportTarget, setSupportTarget] = useState<GangMember | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [cashBalance, setCashBalance] = useState(Number(saved?.cashBalance ?? saved?.baniCurati ?? 1_000_000));
  const [baniMurdari, setBaniMurdari] = useState(Number(saved?.baniMurdari ?? 0)); const [timeFarm, setTimeFarm] = useState(Number(saved?.timeFarm ?? 0));
  const [gangData, setGangData] = useState<GangData>(() => buildInitialGangData(saved)); const [transportMembers, setTransportMembers] = useState(1);
  const formed = Boolean(gangData.name); const level = getGangLevel(gangData.levelIndex); const maxMembers = level.maxMembers; const currentGameHour = Math.max(0, timeFarm);
  const availableMembers = useMemo(() => getAvailableGangMembers(gangData.members, currentGameHour), [gangData.members, currentGameHour]);
  const averageLoyalty = useMemo(() => gangData.members.length ? Math.round(gangData.members.reduce((s, m) => s + m.loyalty, 0) / gangData.members.length) : 0, [gangData.members]);
  const recruitingPower = useMemo(() => getRecruitingPower(gangData.members), [gangData.members]); const upgradeCost = getGangUpgradeCost(gangData.levelIndex);
  const canUpgrade = canAffordGangUpgrade(upgradeCost, gangData); const stockValue = gangStockValue(gangData);
  const opponents = useMemo(() => generateBotOpponents(gangData.levelIndex, gangData.battleBoardSeed), [gangData.levelIndex, gangData.battleBoardSeed]);
  const isFull = gangData.members.length >= maxMembers;
  const pushPopup = useCallback((text: string) => { setPopup(text); setTimeout(() => setPopup(null), 2800); }, []);

  useEffect(() => { const timer = setInterval(() => setRecruitTimer((v) => Math.max(0, v - 1)), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { const current = loadGameState() || {}; saveGameState({ ...current, cashBalance, baniCurati: cashBalance, baniMurdari, timeFarm, gangData }); }, [gangData, cashBalance, baniMurdari, timeFarm]);
  useEffect(() => { const reload = () => { const latest = loadGameState(); if (!latest?.gangData) return; setGangData((v) => applyRemoteGangData(v, latest.gangData)); setCashBalance(Number(latest.cashBalance ?? latest.baniCurati ?? 0)); setBaniMurdari(Number(latest.baniMurdari ?? 0)); setTimeFarm(Number(latest.timeFarm ?? 0)); }; addEventListener('cityflow-gang-updated', reload); return () => removeEventListener('cityflow-gang-updated', reload); }, []);
  useEffect(() => { setTransportMembers((v) => Math.max(1, Math.min(v, Math.max(1, availableMembers.length)))); setGangData((v) => { const members = recoverMembersByGameTime(v.members, currentGameHour); const recruitmentBoard = members.length >= maxMembers ? [] : v.recruitmentBoard.length >= 3 ? v.recruitmentBoard.slice(0, 3) : createRecruitmentBoard(members, 3); return { ...v, members, recruitmentBoard }; }); }, [currentGameHour, maxMembers, availableMembers.length]);
  useEffect(() => { if (!recruitingCandidate || recruitTimer > 0) return; const candidate = recruitingCandidate; setGangData((v) => { if (v.members.length >= maxMembers || !v.recruitmentBoard.some((m) => m.id === candidate.id)) return v; const recruiter = [...v.members].sort((a, b) => b.skills.recruiting - a.skills.recruiting)[0]; const rewarded = recruiter ? awardMemberActivity(v.members, [recruiter.id], { primary: 'recruiting', secondary: 'leadership' }, 14) : v.members; const members = [...rewarded, { ...candidate, joinedAt: Date.now(), status: 'AVAILABLE' as const }]; const replacement = createRecruitmentBoard(members, 1)[0]; const recruitmentBoard = members.length >= maxMembers ? [] : v.recruitmentBoard.map((m) => m.id === candidate.id ? replacement : m).filter((m): m is GangMember => Boolean(m)); return appendLog({ ...v, members, recruitmentBoard }, `${candidate.displayName} joined the gang.`, 'positive'); }); setRecruitingCandidate(null); pushPopup(`${candidate.displayName} joined the gang.`); }, [recruitTimer, recruitingCandidate, maxMembers, pushPopup]);

  const formGang = () => { if (formed || busy) return; if (!gangNameInput.trim()) return pushPopup('Set a gang name.'); if (baniMurdari < 10_000_000) return pushPopup('You need 10,000,000 dirty cash.'); const members = createStarterMembers(4); setBaniMurdari((v) => v - 10_000_000); setGangData((v) => ({ ...v, name: gangNameInput.trim().slice(0, 48), levelIndex: 0, members, recruitmentBoard: createRecruitmentBoard(members, 3), lastLeaveAt: Date.now(), activityLog: [createGangActivityLog('Gang created.', 'positive')] })); pushPopup('Gang created.'); };
  const startRecruit = (id: string) => { if (busy || recruitingCandidate || isFull) return; const candidate = gangData.recruitmentBoard.find((m) => m.id === id); if (candidate) { setRecruitingCandidate(candidate); setRecruitTimer(5 + Math.floor(Math.random() * 6)); } };
  const confirmDismiss = () => { if (!dismissTarget || busy) return; const r = dismissGangMember(gangData.members, dismissTarget.id, gangData.dismissalPressure, gangData.lastDismissalAt); setGangData((v) => appendLog({ ...v, members: r.members, dismissalPressure: r.pressure, lastDismissalAt: r.lastDismissalAt, defensiveCrewIds: v.defensiveCrewIds.filter((id) => id !== r.dismissed?.id), removedEventMemberIds: r.dismissed?.source === 'ADMIN_EVENT' ? [...v.removedEventMemberIds, r.dismissed.id].slice(-100) : v.removedEventMemberIds, recruitmentBoard: r.members.length >= maxMembers ? [] : createRecruitmentBoard(r.members, 3) }, `${r.dismissed?.displayName} dismissed. -${r.loyaltyLoss}% loyalty.`, 'negative')); setDismissTarget(null); pushPopup(`Loyalty decreased by ${r.loyaltyLoss}%.`); };
  const buyLoyaltySupport = (option: Support) => { if (!supportTarget || busy || gangData.cleanBalance < option.cost) return; setGangData((v) => appendLog({ ...v, cleanBalance: v.cleanBalance - option.cost, members: restoreMemberLoyalty(v.members, supportTarget.id, option.loyalty) }, `${supportTarget.displayName}: ${option.label}, +${option.loyalty}% loyalty.`, 'positive')); setSupportTarget(null); pushPopup(`+${option.loyalty}% loyalty`); };
  const confirmUpgrade = async () => { if (!upgradeCost || !canUpgrade || busy || !playerId) return; setBusy(true); try { await syncGangState(playerId, gangData); const remote = await upgradeGangState(playerId); const next = applyRemoteGangData(gangData, remote); setGangData(next); setUpgradeOpen(false); pushPopup(`Gang upgraded to ${getGangLevel(next.levelIndex).name}.`); } catch (e) { pushPopup(e instanceof Error ? e.message : 'Gang upgrade failed.'); } finally { setBusy(false); } };
  const runActivityPresentation = async (type: GangWorkType, participants: number, complete: () => Promise<string> | string) => { const labels = GANG_WORK_LABELS[type], stages = GANG_WORK_STAGES[type]; setBusy(true); setActivity({ ...labels, stages, stageIndex: 0, progress: 0, participants }); try { for (let i = 0; i < stages.length; i += 1) { setActivity((v) => v ? { ...v, stageIndex: i, progress: Math.round((i / stages.length) * 90) } : v); await wait(750); } const resultText = await complete(); setActivity((v) => v ? { ...v, progress: 100, resultText } : v); await wait(1200); } finally { setActivity(null); setBusy(false); } };

  const work = useGangWorkActions({ busy, availableMembers, gangData, maxMembers, timeFarm, transportMembers, cashBalance, baniMurdari, setGangData, setTimeFarm, setCashBalance, setBaniMurdari, runActivityPresentation, pushPopup });
  const battle = useGangBattleActions({ busy, members: availableMembers, gangData, currentGameHour, setBusy, setGangData, setTimeFarm, setBattleOverlay, pushPopup });
  return { activity, averageLoyalty, availableMembers, baniMurdari, battleOverlay, busy, buyLoyaltySupport, canUpgrade, cashBalance, confirmDismiss, confirmUpgrade, currentGameHour, dismissTarget, formGang, formed, gangData, gangNameInput, isFull, level, maxMembers, opponents, popup, recruitingCandidate, recruitingPower, recruitTimer, setDismissTarget, setGangData, setGangNameInput, setSupportTarget, setTransportMembers, setUpgradeOpen, stockValue, supportTarget, timeFarm, transportMembers, upgradeCost, upgradeOpen, startRecruit, ...work, ...battle, openBattles: () => navigate('/gangs/battles'), refreshOpponents: () => setGangData((v) => ({ ...v, battleBoardSeed: v.battleBoardSeed + 1 })) };
}
