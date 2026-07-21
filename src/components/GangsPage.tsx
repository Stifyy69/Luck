import { useEffect, useMemo, useState } from 'react';
import {
  addMemberLoyalty,
  awardMemberActivity,
  calculateFarmingYield,
  createRecruitmentBoard,
  createStarterMembers,
  decayDismissalPressure,
  dismissGangMember,
  getRecruitingPower,
  markMembersWorking,
  migrateGangMembers,
  restoreMemberLoyalty,
  selectActiveMembers,
  type GangMember,
} from '../lib/gangMembers';
import {
  GANG_WORK_LABELS,
  GANG_WORK_STAGES,
  calculateMiningResult,
  calculateTransportResult,
  gangStockValue,
  type GangWorkType,
} from '../lib/gangWork';
import PageDisclaimer from './PageDisclaimer';
import GangActivityOverlay, { type GangActivityOverlayState } from './gangs/GangActivityOverlay';
import GangFinancePanel from './gangs/GangFinancePanel';
import GangLoyaltySupportModal, { LOYALTY_SUPPORT_OPTIONS } from './gangs/GangLoyaltySupportModal';
import GangMemberCard from './gangs/GangMemberCard';
import GangOverviewPanel from './gangs/GangOverviewPanel';
import GangRecruitmentBoard from './gangs/GangRecruitmentBoard';
import GangStoragePanel from './gangs/GangStoragePanel';
import GangWorkPanel from './gangs/GangWorkPanel';

const GAME_KEY = 'luck_game_state_v1';
const GAME_SALT = 'stifyy-ogromania-salt';
const GANG_RAZIA_CHANCE = 0.05;

const LEVELS = [
  { name: 'Nerecunoscut', maxMembers: 10, nextDirty: 300_000_000 },
  { name: 'Recunoscut', maxMembers: 15, nextDirty: 1_000_000_000 },
  { name: 'Neoficiala', maxMembers: 24, nextDirty: 10_000_000_000 },
  { name: 'Oficiala', maxMembers: 34, nextDirty: null },
];

export type GangSection = 'overview' | 'work' | 'members' | 'recruitment' | 'storage' | 'finance';

type GangData = {
  name: string;
  members: GangMember[];
  recruitmentBoard: GangMember[];
  frunze: number;
  white: number;
  blue: number;
  sulfur: number;
  ironOre: number;
  gunpowder: number;
  steel: number;
  cleanBalance: number;
  dirtyBalance: number;
  dirtyEarned: number;
  lastLeaveAt: number;
  onlineNow: number;
  dismissalPressure: number;
  lastDismissalAt: number;
  removedEventMemberIds: string[];
  serverUpdatedAt: string | null;
};

type LoyaltySupportOption = (typeof LOYALTY_SUPPORT_OPTIONS)[number];

function signPayload(payload: unknown) {
  const raw = JSON.stringify(payload) + GAME_SALT;
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  return String(hash);
}

function loadGameState() {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || !parsed?.sig) return null;
    return signPayload(parsed.data) === parsed.sig ? parsed.data : null;
  } catch {
    return null;
  }
}

function saveGameState(data: unknown) {
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify({ data, sig: signPayload(data) }));
  } catch {}
}

function levelIndexFromEarned(dirtyEarned: number) {
  if (dirtyEarned >= 10_000_000_000) return 3;
  if (dirtyEarned >= 1_000_000_000) return 2;
  if (dirtyEarned >= 300_000_000) return 1;
  return 0;
}

function buildInitialGangData(saved: any): GangData {
  const members = migrateGangMembers(saved?.gangData?.members);
  const dirtyEarned = Number(saved?.gangData?.dirtyEarned ?? 0);
  const maxMembers = LEVELS[levelIndexFromEarned(dirtyEarned)].maxMembers;
  const savedBoard = migrateGangMembers(saved?.gangData?.recruitmentBoard)
    .filter((member) => member.rarity !== 'MYTHIC' && member.source !== 'ADMIN_EVENT');
  const formed = Boolean(String(saved?.gangData?.name || '').trim());
  const isFull = members.length >= maxMembers;
  return {
    name: String(saved?.gangData?.name ?? ''),
    members,
    recruitmentBoard: formed && !isFull
      ? (savedBoard.length >= 3 ? savedBoard.slice(0, 3) : createRecruitmentBoard(members, 3))
      : [],
    frunze: Math.max(0, Number(saved?.gangData?.frunze ?? saved?.gangData?.leaves ?? 0)),
    white: Math.max(0, Number(saved?.gangData?.white ?? saved?.gangData?.whitePacks ?? 0)),
    blue: Math.max(0, Number(saved?.gangData?.blue ?? saved?.gangData?.bluePacks ?? 0)),
    sulfur: Math.max(0, Number(saved?.gangData?.sulfur ?? 0)),
    ironOre: Math.max(0, Number(saved?.gangData?.ironOre ?? 0)),
    gunpowder: Math.max(0, Number(saved?.gangData?.gunpowder ?? 0)),
    steel: Math.max(0, Number(saved?.gangData?.steel ?? 0)),
    cleanBalance: Math.max(0, Number(saved?.gangData?.cleanBalance ?? 0)),
    dirtyBalance: Math.max(0, Number(saved?.gangData?.dirtyBalance ?? 0)),
    dirtyEarned,
    lastLeaveAt: Number(saved?.gangData?.lastLeaveAt ?? Date.now()),
    onlineNow: 0,
    dismissalPressure: decayDismissalPressure(
      Number(saved?.gangData?.dismissalPressure ?? 0),
      Number(saved?.gangData?.lastDismissalAt ?? 0),
    ),
    lastDismissalAt: Number(saved?.gangData?.lastDismissalAt ?? 0),
    removedEventMemberIds: Array.isArray(saved?.gangData?.removedEventMemberIds)
      ? saved.gangData.removedEventMemberIds.map((value: unknown) => String(value)).slice(0, 100)
      : [],
    serverUpdatedAt: saved?.gangData?.serverUpdatedAt ? String(saved.gangData.serverUpdatedAt) : null,
  };
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function GangsPage({ section = 'overview' }: { section?: GangSection }) {
  const saved = typeof window !== 'undefined' ? loadGameState() : null;
  const [gangNameInput, setGangNameInput] = useState('');
  const [popup, setPopup] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<GangActivityOverlayState | null>(null);
  const [recruitTimer, setRecruitTimer] = useState(0);
  const [recruitingCandidate, setRecruitingCandidate] = useState<GangMember | null>(null);
  const [dismissTarget, setDismissTarget] = useState<GangMember | null>(null);
  const [supportTarget, setSupportTarget] = useState<GangMember | null>(null);
  const [transportMembers, setTransportMembers] = useState(1);

  const [cashBalance, setCashBalance] = useState(Number(saved?.cashBalance ?? saved?.baniCurati ?? 1_000_000));
  const [baniMurdari, setBaniMurdari] = useState(Number(saved?.baniMurdari ?? 0));
  const [timeFarm, setTimeFarm] = useState(Number(saved?.timeFarm ?? 0));
  const [gangData, setGangData] = useState<GangData>(() => buildInitialGangData(saved));

  const formed = Boolean(gangData.name);
  const levelIndex = levelIndexFromEarned(gangData.dirtyEarned);
  const level = LEVELS[levelIndex];
  const maxMembers = level.maxMembers;
  const isFull = gangData.members.length >= maxMembers;
  const averageLoyalty = useMemo(() => {
    if (gangData.members.length === 0) return 0;
    return Math.round(gangData.members.reduce((sum, member) => sum + member.loyalty, 0) / gangData.members.length);
  }, [gangData.members]);
  const recruitingPower = useMemo(() => getRecruitingPower(gangData.members), [gangData.members]);
  const stockValue = useMemo(() => gangStockValue(gangData), [gangData]);

  const persist = (nextGangData = gangData, nextCash = cashBalance, nextDirty = baniMurdari, nextTimeFarm = timeFarm) => {
    const existing = loadGameState() || {};
    saveGameState({
      ...existing,
      cashBalance: nextCash,
      baniCurati: nextCash,
      baniMurdari: nextDirty,
      timeFarm: nextTimeFarm,
      gangData: nextGangData,
    });
  };

  const pushPopup = (text: string) => {
    setPopup(text);
    window.setTimeout(() => setPopup(null), 3200);
  };

  useEffect(() => {
    const interval = window.setInterval(() => setRecruitTimer((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    persist();
  }, [gangData, cashBalance, baniMurdari, timeFarm]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const reloadFromStorage = () => {
      const latest = loadGameState();
      if (!latest?.gangData) return;
      setGangData(buildInitialGangData(latest));
      setCashBalance(Number(latest?.cashBalance ?? latest?.baniCurati ?? 0));
      setBaniMurdari(Number(latest?.baniMurdari ?? 0));
      setTimeFarm(Number(latest?.timeFarm ?? 0));
    };
    window.addEventListener('cityflow-gang-updated', reloadFromStorage);
    return () => window.removeEventListener('cityflow-gang-updated', reloadFromStorage);
  }, []);

  useEffect(() => {
    setTransportMembers((current) => Math.min(Math.max(1, current), Math.max(1, gangData.members.length)));
    setGangData((current) => {
      const full = current.members.length >= maxMembers;
      if (full && current.recruitmentBoard.length > 0) return { ...current, recruitmentBoard: [] };
      if (!full && current.name && current.recruitmentBoard.length < 3) {
        return { ...current, recruitmentBoard: createRecruitmentBoard(current.members, 3) };
      }
      return current;
    });
  }, [gangData.members.length, maxMembers]);

  useEffect(() => {
    if (!recruitingCandidate || recruitTimer > 0) return;
    const candidate = recruitingCandidate;
    setGangData((current) => {
      if (current.members.length >= maxMembers) return { ...current, recruitmentBoard: [] };
      if (!current.recruitmentBoard.some((entry) => entry.id === candidate.id)) return current;
      const recruiter = [...current.members].sort((left, right) => right.skills.recruiting - left.skills.recruiting)[0];
      const rewardedMembers = recruiter ? awardMemberActivity(current.members, [recruiter.id], 'recruiting', 14) : current.members;
      const nextMembers = [...rewardedMembers, { ...candidate, joinedAt: Date.now(), status: 'AVAILABLE' as const }];
      const willBeFull = nextMembers.length >= maxMembers;
      const replacement = willBeFull ? null : createRecruitmentBoard(nextMembers, 1)[0];
      return {
        ...current,
        members: nextMembers,
        recruitmentBoard: willBeFull
          ? []
          : current.recruitmentBoard.map((entry) => entry.id === candidate.id ? replacement : entry).filter((entry): entry is GangMember => Boolean(entry)),
      };
    });
    setRecruitingCandidate(null);
    pushPopup(`${candidate.displayName} joined the gang for free.`);
  }, [maxMembers, recruitTimer, recruitingCandidate]);

  const runActivityPresentation = async (
    type: GangWorkType,
    participantCount: number,
    complete: () => Promise<string> | string,
  ) => {
    const labels = GANG_WORK_LABELS[type];
    const stages = GANG_WORK_STAGES[type];
    setBusy(true);
    setActivity({ ...labels, stages, stageIndex: 0, progress: 0, participants: participantCount });
    try {
      for (let index = 0; index < stages.length; index += 1) {
        setActivity((current) => current ? { ...current, stageIndex: index, progress: Math.round((index / stages.length) * 90) } : current);
        await wait(850);
      }
      const resultText = await complete();
      setActivity((current) => current ? { ...current, stageIndex: stages.length - 1, progress: 100, resultText } : current);
      await wait(1200);
    } finally {
      setActivity(null);
      setBusy(false);
    }
  };

  const formGang = () => {
    if (formed || busy) return;
    if (!gangNameInput.trim()) return pushPopup('Set a gang name.');
    if (baniMurdari < 10_000_000) return pushPopup('You need 10,000,000 personal dirty cash to create the gang.');
    const starters = createStarterMembers(4);
    setBaniMurdari((current) => current - 10_000_000);
    setGangData({
      ...gangData,
      name: gangNameInput.trim(),
      members: starters,
      recruitmentBoard: createRecruitmentBoard(starters, 3),
      cleanBalance: 0,
      dirtyBalance: 0,
      lastLeaveAt: Date.now(),
      dismissalPressure: 0,
      lastDismissalAt: 0,
      removedEventMemberIds: [],
    });
    pushPopup('Gang created successfully. Four starter members joined.');
  };

  const startRecruit = (candidateId: string) => {
    if (!formed || busy || recruitingCandidate || recruitTimer > 0 || isFull) return;
    const candidate = gangData.recruitmentBoard.find((entry) => entry.id === candidateId);
    if (!candidate) return;
    setRecruitingCandidate(candidate);
    setRecruitTimer(5 + Math.floor(Math.random() * 6));
  };

  const confirmDismiss = () => {
    if (!dismissTarget || busy) return;
    const result = dismissGangMember(gangData.members, dismissTarget.id, gangData.dismissalPressure, gangData.lastDismissalAt);
    setGangData((current) => ({
      ...current,
      members: result.members,
      dismissalPressure: result.pressure,
      lastDismissalAt: result.lastDismissalAt,
      onlineNow: Math.min(current.onlineNow, result.members.length),
      removedEventMemberIds: result.dismissed?.source === 'ADMIN_EVENT'
        ? [...current.removedEventMemberIds, result.dismissed.id].slice(-100)
        : current.removedEventMemberIds,
      recruitmentBoard: result.members.length < maxMembers && current.recruitmentBoard.length === 0
        ? createRecruitmentBoard(result.members, 3)
        : current.recruitmentBoard,
    }));
    setDismissTarget(null);
    pushPopup(`${result.dismissed?.displayName} was dismissed. Every remaining member lost ${result.loyaltyLoss}% loyalty.`);
  };

  const buyLoyaltySupport = (option: LoyaltySupportOption) => {
    if (!supportTarget || gangData.cleanBalance < option.cost) return;
    setGangData((current) => ({
      ...current,
      cleanBalance: current.cleanBalance - option.cost,
      members: restoreMemberLoyalty(current.members, supportTarget.id, option.loyalty),
    }));
    pushPopup(`${supportTarget.displayName} received ${option.label}: +${option.loyalty}% loyalty.`);
    setSupportTarget(null);
  };

  const startCollection = async () => {
    if (busy || gangData.members.length === 0) return;
    const count = Math.max(1, Math.floor(gangData.members.length * (0.55 + Math.random() * 0.45)));
    const participants = selectActiveMembers(gangData.members, count);
    const ids = participants.map((member) => member.id);
    const reward = calculateFarmingYield(participants);
    setGangData((current) => ({ ...current, onlineNow: ids.length, members: markMembersWorking(current.members, ids) }));
    await runActivityPresentation('collect', ids.length, async () => {
      const raid = Math.random() < GANG_RAZIA_CHANCE;
      setTimeFarm((current) => current + 1);
      setGangData((current) => ({
        ...current,
        frunze: raid ? current.frunze : current.frunze + reward.total,
        onlineNow: 0,
        members: awardMemberActivity(current.members, ids, raid ? null : 'farming', raid ? 5 : 18),
      }));
      const text = raid
        ? 'Police raid. Only this harvest was lost. Existing storage is safe.'
        : `Collected ${reward.total.toLocaleString('en-US')} Leaves.`;
      pushPopup(text);
      return text;
    });
  };

  const startMining = async () => {
    if (busy || gangData.members.length === 0) return;
    const participants = selectActiveMembers(gangData.members, Math.max(1, Math.ceil(gangData.members.length * 0.6)));
    const ids = participants.map((member) => member.id);
    const reward = calculateMiningResult();
    setGangData((current) => ({ ...current, onlineNow: ids.length, members: markMembersWorking(current.members, ids) }));
    await runActivityPresentation('mining', ids.length, async () => {
      const raid = Math.random() < GANG_RAZIA_CHANCE;
      setTimeFarm((current) => current + 0.5);
      setGangData((current) => ({
        ...current,
        sulfur: raid ? current.sulfur : current.sulfur + reward.sulfur,
        ironOre: raid ? current.ironOre : current.ironOre + reward.ironOre,
        onlineNow: 0,
        members: awardMemberActivity(current.members, ids, raid ? null : 'streetSmart', raid ? 5 : 16),
      }));
      const text = raid
        ? 'Police raid. Only the current mining haul was lost.'
        : `Mining complete: +${reward.sulfur} Sulfur and +${reward.ironOre} Iron Ore.`;
      pushPopup(text);
      return text;
    });
  };

  const startTransport = async () => {
    if (busy || gangData.members.length === 0) return;
    const participants = selectActiveMembers(gangData.members, Math.min(transportMembers, gangData.members.length));
    const ids = participants.map((member) => member.id);
    setGangData((current) => ({ ...current, onlineNow: ids.length, members: markMembersWorking(current.members, ids) }));
    await runActivityPresentation('transport', ids.length, async () => {
      const result = calculateTransportResult(participants, maxMembers);
      setTimeFarm((current) => current + 0.5);
      setGangData((current) => {
        const rewarded = awardMemberActivity(current.members, ids, 'streetSmart', 24);
        return {
          ...current,
          dirtyBalance: Math.max(0, current.dirtyBalance + result.netPayout),
          dirtyEarned: current.dirtyEarned + Math.max(0, result.netPayout),
          onlineNow: 0,
          members: addMemberLoyalty(rewarded, ids, result.loyaltyGain),
        };
      });
      const incidentText = result.policeIncidents > 0
        ? ` ${result.policeIncidents} members were compromised, costing ${result.policePenalty.toLocaleString('en-US')} dirty.`
        : ' No members were compromised.';
      const text = `${result.qualityLabel}: ${result.netPayout >= 0 ? '+' : '-'}${Math.abs(result.netPayout).toLocaleString('en-US')} dirty.${incidentText} +${result.loyaltyGain}% loyalty.`;
      pushPopup(text);
      return text;
    });
  };

  const startProcessing = async (type: 'white' | 'blue' | 'gunpowder' | 'steel') => {
    if (busy || gangData.members.length === 0) return;
    let units = 0;
    let dirtyCost = 0;
    if (type === 'white') {
      units = Math.floor(gangData.frunze / 1200);
      dirtyCost = units * 900_000;
      units = Math.min(units, Math.floor(gangData.dirtyBalance / 900_000));
      dirtyCost = units * 900_000;
    } else if (type === 'blue') {
      units = Math.floor(gangData.white / 400);
      dirtyCost = units * 100_000;
      units = Math.min(units, Math.floor(gangData.dirtyBalance / 100_000));
      dirtyCost = units * 100_000;
    } else if (type === 'gunpowder') units = Math.floor(gangData.sulfur / 5);
    else units = Math.floor(gangData.ironOre / 5);
    if (units <= 0) return pushPopup('Not enough materials or Gang dirty balance for this processing batch.');

    const participants = selectActiveMembers(gangData.members, Math.max(1, Math.ceil(gangData.members.length * 0.5)));
    const ids = participants.map((member) => member.id);
    setGangData((current) => ({
      ...current,
      frunze: type === 'white' ? current.frunze - units * 1200 : current.frunze,
      white: type === 'blue' ? current.white - units * 400 : current.white,
      sulfur: type === 'gunpowder' ? current.sulfur - units * 5 : current.sulfur,
      ironOre: type === 'steel' ? current.ironOre - units * 5 : current.ironOre,
      dirtyBalance: current.dirtyBalance - dirtyCost,
      onlineNow: ids.length,
      members: markMembersWorking(current.members, ids),
    }));

    await runActivityPresentation(type, ids.length, async () => {
      const raid = Math.random() < GANG_RAZIA_CHANCE;
      setTimeFarm((current) => current + 0.5);
      setGangData((current) => ({
        ...current,
        white: !raid && type === 'white' ? current.white + units * 400 : current.white,
        blue: !raid && type === 'blue' ? current.blue + units * 800 : current.blue,
        gunpowder: !raid && type === 'gunpowder' ? current.gunpowder + units : current.gunpowder,
        steel: !raid && type === 'steel' ? current.steel + units : current.steel,
        onlineNow: 0,
        members: awardMemberActivity(current.members, ids, null, raid ? 5 : 12),
      }));
      const outputLabel = type === 'white' ? `${units * 400} White Packs` : type === 'blue' ? `${units * 800} Blue Packs` : type === 'gunpowder' ? `${units} Gunpowder` : `${units} Steel`;
      const text = raid
        ? 'Police raid. Only the current processing batch was lost. Existing storage is safe.'
        : `Processing complete: +${outputLabel}.`;
      pushPopup(text);
      return text;
    });
  };

  const sellMaterial = (type: 'blue' | 'gunpowder' | 'steel') => {
    if (busy) return;
    const quantity = gangData[type];
    if (quantity <= 0) return;
    const price = type === 'blue' ? 2300 : type === 'gunpowder' ? 5000 : 6000;
    const gain = quantity * price;
    setGangData((current) => ({ ...current, [type]: 0, dirtyBalance: current.dirtyBalance + gain, dirtyEarned: current.dirtyEarned + gain }));
    pushPopup(`${quantity.toLocaleString('en-US')} ${type} sold for ${gain.toLocaleString('en-US')} dirty.`);
  };

  const deposit = (currency: 'clean' | 'dirty', amount: number) => {
    if (amount <= 0) return;
    if (currency === 'clean' && amount <= cashBalance) {
      setCashBalance((current) => current - amount);
      setGangData((current) => ({ ...current, cleanBalance: current.cleanBalance + amount }));
    }
    if (currency === 'dirty' && amount <= baniMurdari) {
      setBaniMurdari((current) => current - amount);
      setGangData((current) => ({ ...current, dirtyBalance: current.dirtyBalance + amount }));
    }
  };

  const withdraw = (currency: 'clean' | 'dirty', amount: number) => {
    if (amount <= 0) return;
    if (currency === 'clean' && amount <= gangData.cleanBalance) {
      setCashBalance((current) => current + amount);
      setGangData((current) => ({ ...current, cleanBalance: current.cleanBalance - amount }));
    }
    if (currency === 'dirty' && amount <= gangData.dirtyBalance) {
      setBaniMurdari((current) => current + amount);
      setGangData((current) => ({ ...current, dirtyBalance: current.dirtyBalance - amount }));
    }
  };

  const launder = (amount: number) => {
    if (amount <= 0 || amount > gangData.dirtyBalance) return;
    const cleanGain = Math.floor(amount * 0.65);
    setGangData((current) => ({ ...current, dirtyBalance: current.dirtyBalance - amount, cleanBalance: current.cleanBalance + cleanGain }));
    pushPopup(`${amount.toLocaleString('en-US')} dirty converted into ${cleanGain.toLocaleString('en-US')} clean.`);
  };

  const renderSection = () => {
    if (section === 'overview') return <GangOverviewPanel name={gangData.name} level={level.name} memberCount={gangData.members.length} maxMembers={maxMembers} averageLoyalty={averageLoyalty} currentWorking={gangData.onlineNow} cleanBalance={gangData.cleanBalance} dirtyBalance={gangData.dirtyBalance} stockValue={stockValue} nextDirty={level.nextDirty} />;
    if (section === 'work') return <GangWorkPanel busy={busy} memberCount={gangData.members.length} transportMembers={transportMembers} onTransportMembersChange={setTransportMembers} storage={gangData} dirtyBalance={gangData.dirtyBalance} onCollect={() => startCollection().catch(() => {})} onMining={() => startMining().catch(() => {})} onTransport={() => startTransport().catch(() => {})} onWhite={() => startProcessing('white').catch(() => {})} onBlue={() => startProcessing('blue').catch(() => {})} onGunpowder={() => startProcessing('gunpowder').catch(() => {})} onSteel={() => startProcessing('steel').catch(() => {})} />;
    if (section === 'storage') return <GangStoragePanel storage={gangData} onSellBlue={() => sellMaterial('blue')} onSellGunpowder={() => sellMaterial('gunpowder')} onSellSteel={() => sellMaterial('steel')} />;
    if (section === 'finance') return <GangFinancePanel gangClean={gangData.cleanBalance} gangDirty={gangData.dirtyBalance} personalClean={cashBalance} personalDirty={baniMurdari} totalEarned={gangData.dirtyEarned} onDeposit={deposit} onWithdraw={withdraw} onLaunder={launder} />;
    if (section === 'recruitment') {
      if (isFull) return <section className="game-panel p-8 text-center"><p className="section-kicker">Recruitment</p><h1 className="mt-3 text-3xl font-black text-white">Gang roster is full.</h1><p className="mt-3 text-sm text-white/38">Recruitment candidates are hidden until a member slot becomes available.</p></section>;
      return <GangRecruitmentBoard candidates={gangData.recruitmentBoard} recruitingCandidateId={recruitingCandidate?.id || null} recruitTimer={recruitTimer} disabled={busy} isFull={false} onRecruit={startRecruit} />;
    }
    return (
      <section className="game-panel p-5 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="section-kicker">Gang members</p><h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white">Roster, loyalty and skills.</h1><p className="mt-2 text-sm text-white/38">Dismissals lower loyalty. Members do not leave automatically. Use Gang clean money to buy support and restore loyalty.</p></div>
          <span className="w-fit rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.13em] text-white/50">Recruiting power {Math.min(100, recruitingPower)}</span>
        </div>
        {gangData.dismissalPressure > 0 ? <p className="mt-4 rounded-xl border border-amber-300/10 bg-amber-400/[0.04] px-4 py-3 text-xs text-amber-100/65">Dismissal pressure {gangData.dismissalPressure}/5. Repeated dismissals increase the loyalty loss, but members never leave from loyalty alone.</p> : null}
        <div className="mt-6 grid gap-3 xl:grid-cols-2">
          {gangData.members.map((member) => <GangMemberCard key={member.id} member={member} disabled={busy} onDismiss={setDismissTarget} onSupport={setSupportTarget} />)}
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-transparent px-4 pb-10 pt-24 text-white sm:px-6 md:px-8">
      {popup ? <div className="animate-toast-in fixed left-1/2 top-4 z-[145] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-[rgba(211,255,81,0.22)] bg-[#11170d]/95 px-4 py-3 text-sm font-bold text-[#edffc0] shadow-2xl backdrop-blur-xl md:top-6">{popup}</div> : null}
      <GangActivityOverlay activity={activity} />

      <div className="mx-auto max-w-[1220px]">
        {!formed ? (
          <section className="game-panel mx-auto max-w-2xl p-5 sm:p-7">
            <p className="section-kicker">Create gang</p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white">Build your organization.</h1>
            <p className="mt-2 text-sm text-white/40">Creation costs 10,000,000 personal dirty cash. The gang starts with four unique members and separate clean and dirty balances.</p>
            <input value={gangNameInput} onChange={(event) => setGangNameInput(event.target.value)} placeholder="Gang name" className="mt-5 w-full rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3 text-sm font-bold text-white outline-none" />
            <button type="button" disabled={busy} onClick={formGang} className="btn-primary mt-3 w-full rounded-xl px-4 py-3 text-sm disabled:opacity-35">Create gang</button>
          </section>
        ) : renderSection()}
      </div>
      <div className="mx-auto mt-5 max-w-[1220px]"><PageDisclaimer /></div>

      {dismissTarget ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setDismissTarget(null)}>
          <div className="w-full max-w-md rounded-[22px] border border-red-300/20 bg-[#151013] p-5" onClick={(event) => event.stopPropagation()}>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-red-200/60">Dismiss member</p>
            <h3 className="mt-2 text-2xl font-black text-white">Remove {dismissTarget.displayName}?</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/45">Every remaining member loses loyalty. Repeated dismissals increase the amount lost. Loyalty never removes a member automatically.</p>
            <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" className="btn-ghost rounded-xl px-4 py-3 text-sm" onClick={() => setDismissTarget(null)}>Keep member</button><button type="button" className="rounded-xl border border-red-300/20 bg-red-500/15 px-4 py-3 text-sm font-black text-red-100" onClick={confirmDismiss}>Dismiss</button></div>
          </div>
        </div>
      ) : null}

      <GangLoyaltySupportModal member={supportTarget} gangCleanBalance={gangData.cleanBalance} onClose={() => setSupportTarget(null)} onPurchase={buyLoyaltySupport} />
    </div>
  );
}
