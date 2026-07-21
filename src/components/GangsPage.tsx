import { useEffect, useMemo, useState } from 'react';
import {
  awardMemberActivity,
  calculateFarmingYield,
  createRecruitmentBoard,
  createStarterMembers,
  decayDismissalPressure,
  dismissGangMember,
  getRecruitingPower,
  markMembersWorking,
  migrateGangMembers,
  selectActiveMembers,
  type GangMember,
} from '../lib/gangMembers';
import PageDisclaimer from './PageDisclaimer';
import SharedStatsPanel from './SharedStatsPanel';
import GangMemberCard from './gangs/GangMemberCard';
import GangRecruitmentBoard from './gangs/GangRecruitmentBoard';

const GAME_KEY = 'luck_game_state_v1';
const GAME_SALT = 'stifyy-ogromania-salt';
const GANG_RAZIA_CHANCE = 0.05;

const LEVELS = [
  { name: 'Nerecunoscut', maxMembers: 10, nextDirty: 300_000_000 },
  { name: 'Recunoscut', maxMembers: 15, nextDirty: 1_000_000_000 },
  { name: 'Neoficiala', maxMembers: 24, nextDirty: 10_000_000_000 },
  { name: 'Oficiala', maxMembers: 34, nextDirty: null },
];

type GangAction = 'collect' | 'white' | 'blue';

type GangData = {
  name: string;
  members: GangMember[];
  recruitmentBoard: GangMember[];
  frunze: number;
  white: number;
  blue: number;
  dirtyEarned: number;
  lastLeaveAt: number;
  onlineNow: number;
  dismissalPressure: number;
  lastDismissalAt: number;
  removedEventMemberIds: string[];
};

type PendingConversion = {
  type: GangAction;
  needed: number;
  cleanCost: number;
  participantIds: string[];
  units: number;
};

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

function buildInitialGangData(saved: any): GangData {
  const members = migrateGangMembers(saved?.gangData?.members);
  const savedBoard = migrateGangMembers(saved?.gangData?.recruitmentBoard)
    .filter((member) => member.rarity !== 'MYTHIC' && member.source !== 'ADMIN_EVENT');
  const formed = Boolean(String(saved?.gangData?.name || '').trim());
  return {
    name: String(saved?.gangData?.name ?? ''),
    members,
    recruitmentBoard: formed
      ? (savedBoard.length >= 3 ? savedBoard.slice(0, 3) : createRecruitmentBoard(members, 3))
      : [],
    frunze: Number(saved?.gangData?.frunze ?? 0),
    white: Number(saved?.gangData?.white ?? 0),
    blue: Number(saved?.gangData?.blue ?? 0),
    dirtyEarned: Number(saved?.gangData?.dirtyEarned ?? 0),
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
  };
}

export default function GangsPage() {
  const saved = typeof window !== 'undefined' ? loadGameState() : null;
  const [gangNameInput, setGangNameInput] = useState('');
  const [popup, setPopup] = useState<string | null>(null);
  const [actionTimer, setActionTimer] = useState(0);
  const [actionType, setActionType] = useState<GangAction | null>(null);
  const [recruitTimer, setRecruitTimer] = useState(0);
  const [recruitingCandidate, setRecruitingCandidate] = useState<GangMember | null>(null);
  const [dismissTarget, setDismissTarget] = useState<GangMember | null>(null);
  const [confirmConvert, setConfirmConvert] = useState<PendingConversion | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const [cashBalance, setCashBalance] = useState(Number(saved?.cashBalance ?? 1_000_000));
  const [baniMurdari, setBaniMurdari] = useState(Number(saved?.baniMurdari ?? 0));
  const [timeFarm, setTimeFarm] = useState(Number(saved?.timeFarm ?? 0));
  const [gangData, setGangData] = useState<GangData>(() => buildInitialGangData(saved));

  const formed = Boolean(gangData.name);
  const levelIndex = gangData.dirtyEarned >= 10_000_000_000 ? 3 : gangData.dirtyEarned >= 1_000_000_000 ? 2 : gangData.dirtyEarned >= 300_000_000 ? 1 : 0;
  const level = LEVELS[levelIndex];
  const maxMembers = level.maxMembers;
  const activeWorkers = gangData.members.length;
  const averageLoyalty = useMemo(() => {
    if (gangData.members.length === 0) return 0;
    return Math.round(gangData.members.reduce((sum, member) => sum + member.loyalty, 0) / gangData.members.length);
  }, [gangData.members]);
  const recruitingPower = useMemo(() => getRecruitingPower(gangData.members), [gangData.members]);

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
    window.setTimeout(() => setPopup(null), 2600);
  };

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActionTimer((current) => Math.max(0, current - 1));
      setRecruitTimer((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    persist();
  }, [gangData, cashBalance, baniMurdari, timeFarm]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const reloadFromStorage = () => {
      const latest = loadGameState();
      if (!latest?.gangData) return;
      const next = buildInitialGangData(latest);
      setGangData((current) => {
        const protectedMythics = next.members.filter((member) => member.rarity === 'MYTHIC' && member.source === 'ADMIN_EVENT');
        if (protectedMythics.length === 0) return current;
        const existingIds = new Set(current.members.map((member) => member.id));
        const additions = protectedMythics.filter((member) => !existingIds.has(member.id));
        return additions.length > 0 ? { ...current, members: [...current.members, ...additions].slice(0, maxMembers) } : current;
      });
    };
    window.addEventListener('cityflow-gang-updated', reloadFromStorage);
    return () => window.removeEventListener('cityflow-gang-updated', reloadFromStorage);
  }, [maxMembers]);

  useEffect(() => {
    if (!recruitingCandidate || recruitTimer > 0) return;
    const candidate = recruitingCandidate;
    setGangData((current) => {
      if (current.members.length >= maxMembers) return current;
      if (!current.recruitmentBoard.some((entry) => entry.id === candidate.id)) return current;

      const recruiter = [...current.members].sort((left, right) => right.skills.recruiting - left.skills.recruiting)[0];
      const rewardedMembers = recruiter
        ? awardMemberActivity(current.members, [recruiter.id], 'recruiting', 14)
        : current.members;
      const nextMembers = [...rewardedMembers, { ...candidate, joinedAt: Date.now(), status: 'AVAILABLE' as const }];
      const replacement = createRecruitmentBoard(nextMembers, 1)[0];
      if (!replacement) return current;
      return {
        ...current,
        members: nextMembers,
        recruitmentBoard: current.recruitmentBoard.map((entry) => entry.id === candidate.id ? replacement : entry).filter(Boolean),
      };
    });
    setRecruitingCandidate(null);
    pushPopup(`${candidate.displayName} joined the gang for free.`);
  }, [maxMembers, recruitTimer, recruitingCandidate]);

  const formGang = () => {
    if (formed) return;
    if (!gangNameInput.trim()) {
      pushPopup('Set a gang name.');
      return;
    }
    if (baniMurdari < 10_000_000) {
      pushPopup('You need 10,000,000 dirty cash to create the gang.');
      return;
    }
    const starters = createStarterMembers(4);
    const nextDirty = baniMurdari - 10_000_000;
    const nextGangData: GangData = {
      ...gangData,
      name: gangNameInput.trim(),
      members: starters,
      recruitmentBoard: createRecruitmentBoard(starters, 3),
      lastLeaveAt: Date.now(),
      dismissalPressure: 0,
      lastDismissalAt: 0,
      removedEventMemberIds: [],
    };
    setBaniMurdari(nextDirty);
    setGangData(nextGangData);
    pushPopup('Gang created successfully. Four starter members joined.');
  };

  const startRecruit = (candidateId: string) => {
    if (!formed || actionType || recruitingCandidate || recruitTimer > 0) return;
    if (gangData.members.length >= maxMembers) {
      pushPopup('You reached the member limit for your current level.');
      return;
    }
    const candidate = gangData.recruitmentBoard.find((entry) => entry.id === candidateId);
    if (!candidate) return;
    setRecruitingCandidate(candidate);
    setRecruitTimer(5 + Math.floor(Math.random() * 6));
  };

  const confirmDismiss = () => {
    if (!dismissTarget || actionType) return;
    const result = dismissGangMember(
      gangData.members,
      dismissTarget.id,
      gangData.dismissalPressure,
      gangData.lastDismissalAt,
    );
    setGangData((current) => ({
      ...current,
      members: result.members,
      dismissalPressure: result.pressure,
      lastDismissalAt: result.lastDismissalAt,
      onlineNow: Math.min(current.onlineNow, result.members.length),
      removedEventMemberIds: result.dismissed?.source === 'ADMIN_EVENT'
        ? [...current.removedEventMemberIds, result.dismissed.id].slice(-100)
        : current.removedEventMemberIds,
    }));
    setDismissTarget(null);
    if (result.voluntaryDeparture) {
      pushPopup(`${result.dismissed?.displayName} was dismissed. Loyalty dropped by ${result.loyaltyLoss}. ${result.voluntaryDeparture.displayName} also left.`);
    } else {
      pushPopup(`${result.dismissed?.displayName} was dismissed. Every remaining member lost ${result.loyaltyLoss} loyalty.`);
    }
  };

  const runGangAction = (type: GangAction) => {
    if (!formed || actionType) return;
    if (activeWorkers <= 0) {
      pushPopup('Recruit at least one member before starting gang work.');
      return;
    }

    const online = Math.max(1, Math.floor(activeWorkers * (0.5 + Math.random() * 0.5)));
    const participants = selectActiveMembers(gangData.members, online);
    const participantIds = participants.map((member) => member.id);
    let processUnits = 1;
    if (type === 'white') processUnits = Math.floor(gangData.frunze / 1200);
    else if (type === 'blue') processUnits = Math.floor(gangData.white / 400);

    if (type !== 'collect' && processUnits <= 0) {
      pushPopup(type === 'white' ? 'You do not have leaves to process.' : 'You do not have white packs to process.');
      return;
    }

    if (type !== 'collect') {
      const dirtyCostPerUnit = type === 'white' ? 900_000 : 100_000;
      const maxUnitsByMoney = Math.floor((baniMurdari + Math.floor(cashBalance / 0.65)) / dirtyCostPerUnit);
      processUnits = Math.min(processUnits, Math.max(0, maxUnitsByMoney));
      if (processUnits <= 0) {
        pushPopup('You do not have enough money for processing.');
        return;
      }
      const needsDirty = processUnits * dirtyCostPerUnit;
      if (baniMurdari < needsDirty) {
        const needed = needsDirty - baniMurdari;
        const cleanCost = Math.ceil(needed * 0.65);
        if (cashBalance < cleanCost) {
          pushPopup(`You do not have ${needsDirty.toLocaleString('en-US')} dirty cash.`);
          return;
        }
        setConfirmConvert({ type, needed, cleanCost, participantIds, units: processUnits });
        return;
      }
    }

    startGangAction(type, participantIds, 0, processUnits);
  };

  const startGangAction = (type: GangAction, participantIds: string[], convertedDirtyCost: number, processUnits: number) => {
    const needsDirty = type === 'white' ? 900_000 * processUnits : type === 'blue' ? 100_000 * processUnits : 0;
    const dirtyDebit = Math.max(0, needsDirty - convertedDirtyCost);
    const participants = gangData.members.filter((member) => participantIds.includes(member.id));
    const farmingYield = type === 'collect' ? calculateFarmingYield(participants) : null;

    setActionType(type);
    setActionTimer(5);
    setGangData((current) => ({
      ...current,
      onlineNow: participantIds.length,
      members: markMembersWorking(current.members, participantIds),
    }));

    window.setTimeout(() => {
      const razia = Math.random() < GANG_RAZIA_CHANCE;
      if (razia) {
        setGangData((current) => ({
          ...current,
          frunze: 0,
          white: 0,
          blue: 0,
          onlineNow: 0,
          members: current.members.map((member) => ({ ...member, status: 'AVAILABLE' as const })),
        }));
        pushPopup('POLICE RAID!!! The gang lost all stock.');
        setActionType(null);
        setActionTimer(0);
        return;
      }

      if (type === 'collect' && farmingYield) {
        setGangData((current) => ({
          ...current,
          frunze: current.frunze + farmingYield.total,
          onlineNow: 0,
          members: awardMemberActivity(current.members, participantIds, 'farming', 18),
        }));
        setTimeFarm((current) => current + 1);
        const exceptional = farmingYield.exceptionalCount > 0 ? ` ${farmingYield.exceptionalCount} exceptional harvest bonus${farmingYield.exceptionalCount === 1 ? '' : 'es'}.` : '';
        pushPopup(`Collected ${farmingYield.total.toLocaleString('en-US')} leaves, including ${farmingYield.bonus.toLocaleString('en-US')} from skills.${exceptional}`);
      }
      if (type === 'white') {
        setGangData((current) => ({
          ...current,
          frunze: current.frunze - 1200 * processUnits,
          white: current.white + 400 * processUnits,
          onlineNow: 0,
          members: awardMemberActivity(current.members, participantIds, null, 10),
        }));
        if (dirtyDebit > 0) setBaniMurdari((current) => current - dirtyDebit);
        pushPopup(`White processing completed with ${participantIds.length} members.`);
      }
      if (type === 'blue') {
        setGangData((current) => ({
          ...current,
          white: current.white - 400 * processUnits,
          blue: current.blue + 800 * processUnits,
          onlineNow: 0,
          members: awardMemberActivity(current.members, participantIds, null, 10),
        }));
        if (dirtyDebit > 0) setBaniMurdari((current) => current - dirtyDebit);
        pushPopup(`Blue processing completed with ${participantIds.length} members.`);
      }
      setActionType(null);
      setActionTimer(0);
    }, 5 * 1000);
  };

  const confirmConvertAndStart = () => {
    if (!confirmConvert || isConverting) return;
    setIsConverting(true);
    setCashBalance((current) => current - confirmConvert.cleanCost);
    const payload = confirmConvert;
    setConfirmConvert(null);
    window.setTimeout(() => {
      startGangAction(payload.type, payload.participantIds, payload.needed, payload.units);
      setIsConverting(false);
    }, 0);
  };

  const convertDirtyToClean = () => {
    if (actionType || baniMurdari <= 0) return;
    const gainClean = Math.floor(baniMurdari * 0.65);
    setBaniMurdari(0);
    setCashBalance((current) => current + gainClean);
    pushPopup(`Converted to clean: +${gainClean.toLocaleString('en-US')}.`);
  };

  const sellGangBlue = () => {
    if (!formed || gangData.blue <= 0) return;
    const gain = gangData.blue * 2300;
    setBaniMurdari((current) => current + gain);
    setGangData((current) => ({ ...current, blue: 0, dirtyEarned: current.dirtyEarned + gain }));
    pushPopup(`Gang sale: +${gain.toLocaleString('en-US')} dirty cash.`);
  };

  const deliverGangBlue = () => {
    if (!formed || gangData.blue < 100) {
      pushPopup('You need at least 100 blue units for delivery.');
      return;
    }
    const online = Math.max(1, Math.floor(Math.max(1, activeWorkers) * (0.5 + Math.random() * 0.5)));
    const chunks = Math.min(Math.floor(gangData.blue / 100), online);
    const qty = chunks * 100;
    if (qty <= 0) return;
    const caught = Math.random() < GANG_RAZIA_CHANCE;
    if (caught) {
      setGangData((current) => ({ ...current, blue: current.blue - qty }));
      setTimeFarm((current) => current + 0.25);
      pushPopup(`POLICE RAID!!! You lost ${qty} blue units.`);
      return;
    }
    const gain = qty * 3179;
    setGangData((current) => ({ ...current, blue: current.blue - qty, dirtyEarned: current.dirtyEarned + gain }));
    setBaniMurdari((current) => current + gain);
    setTimeFarm((current) => current + 0.25);
    pushPopup(`Delivery successful (${qty}): +${gain.toLocaleString('en-US')} dirty cash.`);
  };

  return (
    <div className="min-h-screen bg-transparent px-4 pb-10 pt-24 text-white sm:px-6">
      <div className="mx-auto grid max-w-[1460px] grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="hud-panel p-4 backdrop-blur-xl sm:p-6">
          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--accent)]/65">Organization management</p>
            <h1 className="mt-2 text-4xl font-black uppercase tracking-tight">Gangs</h1>
          </div>

          {!formed ? (
            <div className="mx-auto mt-6 max-w-xl rounded-xl border border-white/15 bg-black/25 p-4">
              <p className="text-sm text-white/75">Create Unrecognized Gang (cost: 10,000,000 dirty cash)</p>
              <p className="mt-2 text-xs leading-relaxed text-white/40">The gang starts with four unique members. Future recruitment is free.</p>
              <input value={gangNameInput} onChange={(event) => setGangNameInput(event.target.value)} placeholder="Gang name" className="mt-3 w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2" />
              <button type="button" onClick={formGang} className="mt-3 w-full rounded-lg bg-rose-500/80 px-4 py-2 font-black">Create gang</button>
            </div>
          ) : (
            <>
              <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <Card label="Gang" value={gangData.name} />
                <Card label="Level" value={level.name} />
                <Card label="Members" value={`${gangData.members.length}/${maxMembers}`} />
                <Card label="Current working" value={`${gangData.onlineNow}`} />
                <Card label="Average loyalty" value={`${averageLoyalty}%`} />
                <Card label="Total dirty earned" value={`${gangData.dirtyEarned.toLocaleString('en-US')} $`} />
              </div>
              <div className="mt-3 flex flex-col gap-2 rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3 text-xs leading-relaxed text-white/42 sm:flex-row sm:items-center sm:justify-between">
                <span>{level.nextDirty ? `Next gang level at ${level.nextDirty.toLocaleString('en-US')} dirty cash.` : 'Maximum gang level reached.'}</span>
                <span>Recruiting power: {Math.min(100, recruitingPower)}</span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <ActionButton title="Gang leaf farm" detail="Farming and Leadership affect the final harvest" onClick={() => runGangAction('collect')} disabled={Boolean(actionType)} />
                <ActionButton title="Gang white processing" detail="1200 leaves + 900k / unit" onClick={() => runGangAction('white')} disabled={Boolean(actionType)} />
                <ActionButton title="Gang blue processing" detail="400 white + 100k / unit" onClick={() => runGangAction('blue')} disabled={Boolean(actionType)} />
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                <Card label="Leaves gang" value={gangData.frunze.toLocaleString('en-US')} />
                <Card label="White gang" value={gangData.white.toLocaleString('en-US')} />
                <Card label="Blue gang" value={gangData.blue.toLocaleString('en-US')} />
                <button type="button" onClick={sellGangBlue} className={`rounded-xl border border-white/15 p-3 text-sm font-black ${gangData.blue > 0 ? 'bg-emerald-500/70' : 'bg-[#2a2744] text-white/50'}`} disabled={gangData.blue <= 0}>
                  Sell all blue
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={deliverGangBlue} className={`rounded-xl border border-white/15 px-4 py-2 text-sm font-black ${gangData.blue >= 100 ? 'bg-sky-500/70' : 'bg-[#2a2744] text-white/50'}`} disabled={gangData.blue < 100}>
                  Deliver 100 / working member (3179)
                </button>
                <button
                  type="button"
                  onClick={convertDirtyToClean}
                  disabled={baniMurdari <= 0 || Boolean(actionType)}
                  className={`rounded-xl border border-white/15 px-4 py-2 text-sm font-black ${baniMurdari > 0 && !actionType ? 'bg-amber-500/70' : 'bg-[#2a2744] text-white/50'}`}
                >
                  Convert dirty to clean
                </button>
              </div>

              <div className="mt-5">
                <GangRecruitmentBoard
                  candidates={gangData.recruitmentBoard}
                  recruitingCandidateId={recruitingCandidate?.id || null}
                  recruitTimer={recruitTimer}
                  disabled={Boolean(actionType)}
                  isFull={gangData.members.length >= maxMembers}
                  onRecruit={startRecruit}
                />
              </div>

              <section className="mt-5 rounded-[24px] border border-white/[0.08] bg-black/20 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--accent)]/70">Member roster</p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">Unique identities and skills</h2>
                    <p className="mt-2 max-w-2xl text-xs leading-relaxed text-white/38">
                      Members never leave from inactivity. Dismissing somebody lowers the loyalty of everyone left behind. Repeated dismissals increase the chance that the lowest-loyalty member leaves as well.
                    </p>
                  </div>
                  {gangData.dismissalPressure > 0 ? (
                    <span className="w-fit rounded-full border border-amber-300/15 bg-amber-400/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.13em] text-amber-100/80">
                      Dismissal pressure {gangData.dismissalPressure}/5
                    </span>
                  ) : null}
                </div>

                {gangData.members.length > 0 ? (
                  <div className="mt-5 grid gap-3 xl:grid-cols-2">
                    {gangData.members.map((member) => (
                      <GangMemberCard key={member.id} member={member} disabled={Boolean(actionType)} onDismiss={setDismissTarget} />
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl border border-dashed border-white/[0.08] p-8 text-center text-sm text-white/35">
                    The gang has no members. Recruit from the board above.
                  </div>
                )}
              </section>
            </>
          )}

          {actionType ? (
            <div className="mt-4 rounded-xl border border-violet-300/30 bg-violet-500/15 p-4 text-center">
              <p className="text-sm text-white/75">Gang in action...</p>
              <p className="mt-1 text-2xl font-black text-violet-200">{actionTimer}s</p>
            </div>
          ) : null}
        </div>
        <SharedStatsPanel />
      </div>
      <div className="mx-auto mt-5 max-w-[1460px]"><PageDisclaimer /></div>

      {popup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={() => setPopup(null)}>
          <div onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl border border-white/25 bg-[#1a1635] px-5 py-5 text-center text-base font-semibold text-white shadow-xl">
            {popup}
          </div>
        </div>
      ) : null}

      {dismissTarget ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setDismissTarget(null)}>
          <div className="w-full max-w-md rounded-[22px] border border-red-300/20 bg-[#151013] p-5" onClick={(event) => event.stopPropagation()}>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-red-200/60">Dismiss member</p>
            <h3 className="mt-2 text-2xl font-black text-white">Remove {dismissTarget.displayName}?</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/45">
              Recruitment is free, but dismissals damage trust. Every remaining member will lose loyalty, and repeated dismissals can make the lowest-loyalty member leave too.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost rounded-xl px-4 py-3 text-sm" onClick={() => setDismissTarget(null)}>Keep member</button>
              <button type="button" className="rounded-xl border border-red-300/20 bg-red-500/15 px-4 py-3 text-sm font-black text-red-100" onClick={confirmDismiss}>Dismiss</button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmConvert ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !isConverting && setConfirmConvert(null)}>
          <div className="w-full max-w-md rounded-2xl border border-amber-300/40 bg-[#1a142d] p-5 text-white" onClick={(event) => event.stopPropagation()}>
            <p className="text-lg font-black">Convert clean money into dirty money for gang?</p>
            <p className="mt-2 text-sm text-white/70">
              Required dirty: {confirmConvert.needed.toLocaleString('en-US')} · Clean cost: {confirmConvert.cleanCost.toLocaleString('en-US')}
            </p>
            <div className="mt-4 flex gap-2">
              <button className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 font-bold disabled:opacity-60" onClick={confirmConvertAndStart} type="button" disabled={isConverting}>Yes</button>
              <button className="flex-1 rounded-lg bg-white/10 px-4 py-2 font-bold disabled:opacity-60" onClick={() => setConfirmConvert(null)} type="button" disabled={isConverting}>No</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-black/25 p-3 text-center">
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">{label}</p>
      <p className="mt-1 text-base font-black text-white">{value}</p>
    </div>
  );
}

function ActionButton({
  title,
  detail,
  onClick,
  disabled,
}: {
  title: string;
  detail: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`rounded-xl border border-white/15 p-4 text-left ${disabled ? 'bg-[#2a2744] text-white/50' : 'bg-gradient-to-br from-fuchsia-500/25 to-violet-700/15 hover:brightness-110'}`}>
      <p className="text-base font-black">{title}</p>
      <p className="mt-1 text-sm">{detail}</p>
    </button>
  );
}
