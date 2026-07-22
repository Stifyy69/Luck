import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { applyWorkFatigue } from '../lib/gangActivity';
import {
  addMemberLoyalty,
  awardMemberActivity,
  markMembersWorking,
  type GangMember,
  type MemberTrainingPlan,
} from '../lib/gangMembers';
import type { GangData } from '../lib/gangState';
import {
  GANG_PROCESSING_RECIPES,
  calculateMaxProcessingBatches,
  type GangProcessingType,
  type GangWorkType,
} from '../lib/gangWork';
import { appendLog, applyRemoteGangData } from '../lib/gangLocalState';
import { launderGangFunds, performGangWork, processGangMaterial, sellGangMaterial, transferGangFunds } from '../lib/platformApi';

export type SellableGangMaterial = 'blue' | 'gunpowder' | 'steel';
type Currency = 'clean' | 'dirty';

type Options = {
  busy: boolean;
  availableMembers: GangMember[];
  gangData: GangData;
  maxMembers: number;
  timeFarm: number;
  transportMembers: number;
  cashBalance: number;
  baniMurdari: number;
  setGangData: Dispatch<SetStateAction<GangData>>;
  setTimeFarm: Dispatch<SetStateAction<number>>;
  setCashBalance: Dispatch<SetStateAction<number>>;
  setBaniMurdari: Dispatch<SetStateAction<number>>;
  runActivityPresentation: (type: GangWorkType, participantCount: number, complete: () => Promise<string> | string) => Promise<void>;
  pushPopup: (message: string) => void;
  playerId: string | null;
};

function randomCrew(members: GangMember[], count: number) {
  return [...members].sort(() => Math.random() - 0.5).slice(0, Math.max(0, Math.min(count, members.length)));
}

function trainAndFatigue(members: GangMember[], ids: string[], training: MemberTrainingPlan, xp: number, workType: string) {
  return applyWorkFatigue(awardMemberActivity(members, ids, training, xp), ids, workType);
}

function addFatigueLog(data: GangData, names: string[]) {
  if (names.length === 0) return data;
  const label = names.length === 1 ? names[0] : `${names.length} members`;
  return appendLog(data, `${label} lost 5% loyalty from repeated work.`, 'warning');
}

function operationId(prefix: string) {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '') : `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${random}`;
}

export function useGangWorkActions(options: Options) {
  const {
    busy, availableMembers, gangData, maxMembers, transportMembers,
    cashBalance, baniMurdari, setGangData, setTimeFarm, setCashBalance,
    setBaniMurdari, runActivityPresentation, pushPopup, playerId,
  } = options;
  const [economyBusy, setEconomyBusy] = useState(false);
  const economyLock = useRef(false);
  const isBlocked = () => busy || economyBusy || economyLock.current;

  const startCollection = async () => {
    if (isBlocked() || availableMembers.length === 0 || !playerId) return;
    const count = Math.max(1, Math.floor(availableMembers.length * (0.55 + Math.random() * 0.45)));
    const participants = randomCrew(availableMembers, count);
    const ids = participants.map((member) => member.id);
    economyLock.current = true;
    setEconomyBusy(true);
    setGangData((current) => ({ ...current, onlineNow: ids.length, members: markMembersWorking(current.members, ids) }));
    try {
      await runActivityPresentation('collect', ids.length, async () => {
        const result = await performGangWork(playerId, 'collect', ids, operationId('work_collect'));
        setTimeFarm((current) => current + 1);
        setGangData((current) => {
          const remote = applyRemoteGangData(current, result.gang);
          const fatigue = trainAndFatigue(remote.members, ids, { primary: 'farming', secondary: 'leadership' }, result.raided ? 5 : 18, 'collect');
          let next: GangData = { ...remote, onlineNow: 0, members: fatigue.members };
          next = appendLog(next, result.raided ? 'Police raid: current Leaves harvest lost.' : `+${result.leaves.toLocaleString('en-US')} Leaves.`, result.raided ? 'negative' : 'positive');
          return addFatigueLog(next, fatigue.penalized.map((member) => member.displayName));
        });
        const text = result.raided ? 'Police raid. Current harvest lost.' : `+${result.leaves.toLocaleString('en-US')} Leaves`;
        pushPopup(text);
        return text;
      });
    } catch (error) {
      pushPopup(error instanceof Error ? error.message : 'Gang collection failed.');
    } finally {
      economyLock.current = false;
      setEconomyBusy(false);
    }
  };

  const startMining = async () => {
    if (isBlocked() || availableMembers.length === 0 || !playerId) return;
    const participants = randomCrew(availableMembers, Math.max(1, Math.ceil(availableMembers.length * 0.6)));
    const ids = participants.map((member) => member.id);
    economyLock.current = true;
    setEconomyBusy(true);
    setGangData((current) => ({ ...current, onlineNow: ids.length, members: markMembersWorking(current.members, ids) }));
    try {
      await runActivityPresentation('mining', ids.length, async () => {
        const result = await performGangWork(playerId, 'mining', ids, operationId('work_mining'));
        setTimeFarm((current) => current + 0.5);
        setGangData((current) => {
          const remote = applyRemoteGangData(current, result.gang);
          const fatigue = trainAndFatigue(remote.members, ids, { primary: 'farming', secondary: 'streetSmart' }, result.raided ? 5 : 16, 'mining');
          let next: GangData = { ...remote, onlineNow: 0, members: fatigue.members };
          next = appendLog(next, result.raided ? 'Police raid: current mining haul lost.' : `+${result.sulfur} Sulfur, +${result.ironOre} Iron Ore.`, result.raided ? 'negative' : 'positive');
          return addFatigueLog(next, fatigue.penalized.map((member) => member.displayName));
        });
        const text = result.raided ? 'Police raid. Current haul lost.' : `+${result.sulfur} Sulfur, +${result.ironOre} Iron Ore`;
        pushPopup(text);
        return text;
      });
    } catch (error) {
      pushPopup(error instanceof Error ? error.message : 'Gang mining failed.');
    } finally {
      economyLock.current = false;
      setEconomyBusy(false);
    }
  };

  const startTransport = async () => {
    if (isBlocked() || availableMembers.length === 0 || !playerId) return;
    const participants = randomCrew(availableMembers, Math.min(transportMembers, availableMembers.length));
    const ids = participants.map((member) => member.id);
    economyLock.current = true;
    setEconomyBusy(true);
    setGangData((current) => ({ ...current, onlineNow: ids.length, members: markMembersWorking(current.members, ids) }));
    try {
      await runActivityPresentation('transport', ids.length, async () => {
        const result = await performGangWork(playerId, 'transport', ids, operationId('work_transport'));
        setTimeFarm((current) => current + 0.5);
        setGangData((current) => {
          const remote = applyRemoteGangData(current, result.gang);
          const trained = awardMemberActivity(remote.members, ids, { primary: 'streetSmart', secondary: 'tactics' }, 24);
          const loyal = addMemberLoyalty(trained, ids, 1);
          const fatigue = applyWorkFatigue(loyal, ids, 'transport');
          let next: GangData = { ...remote, onlineNow: 0, members: fatigue.members };
          next = appendLog(next, result.raided ? 'Police raid: transport payout lost.' : `+${result.dirtyPayout.toLocaleString('en-US')} dirty, +1% loyalty.`, result.raided ? 'negative' : 'positive');
          return addFatigueLog(next, fatigue.penalized.map((member) => member.displayName));
        });
        const text = result.raided ? 'Police raid. Transport payout lost.' : `+${result.dirtyPayout.toLocaleString('en-US')} dirty, +1% loyalty`;
        pushPopup(text);
        return text;
      });
    } catch (error) {
      pushPopup(error instanceof Error ? error.message : 'Gang transport failed.');
    } finally {
      economyLock.current = false;
      setEconomyBusy(false);
    }
  };

  const startProcessing = async (type: GangProcessingType, requestedBatches: number) => {
    if (isBlocked() || availableMembers.length === 0 || !playerId) return;
    const maximum = calculateMaxProcessingBatches(type, gangData, gangData.dirtyBalance);
    const batches = Math.max(0, Math.min(maximum, Math.floor(requestedBatches)));
    if (batches <= 0) return pushPopup('Not enough materials or Gang dirty cash.');
    const recipe = GANG_PROCESSING_RECIPES[type];
    const participants = randomCrew(availableMembers, Math.max(1, Math.ceil(availableMembers.length * 0.5)));
    const ids = participants.map((member) => member.id);
    economyLock.current = true;
    setEconomyBusy(true);
    setGangData((current) => ({ ...current, onlineNow: ids.length, members: markMembersWorking(current.members, ids) }));
    try {
      await runActivityPresentation(type, ids.length, async () => {
        const result = await processGangMaterial(playerId, type, batches, operationId(`process_${type}`));
        setTimeFarm((current) => current + 0.5);
        setGangData((current) => {
          const remote = applyRemoteGangData(current, result.gang);
          const training: MemberTrainingPlan = type === 'white' || type === 'blue' ? { primary: 'streetSmart', secondary: 'leadership' } : { primary: 'tactics', secondary: 'streetSmart' };
          const fatigue = trainAndFatigue(remote.members, ids, training, result.raided ? 5 : 12, type);
          let next: GangData = { ...remote, onlineNow: 0, members: fatigue.members };
          next = appendLog(next, result.raided ? `Police raid: current ${type} batch lost.` : `+${result.outputAdded.toLocaleString('en-US')} ${recipe.output}.`, result.raided ? 'negative' : 'positive');
          return addFatigueLog(next, fatigue.penalized.map((member) => member.displayName));
        });
        const text = result.raided ? 'Police raid. Current batch lost.' : `+${result.outputAdded.toLocaleString('en-US')} ${recipe.output}`;
        pushPopup(text);
        return text;
      });
    } catch (error) {
      setGangData((current) => ({ ...current, onlineNow: 0, members: markMembersWorking(current.members, []) }));
      pushPopup(error instanceof Error ? error.message : 'Gang processing failed.');
    } finally {
      economyLock.current = false;
      setEconomyBusy(false);
    }
  };

  const sellMaterial = async (type: SellableGangMaterial, requestedQuantity: number) => {
    if (isBlocked() || !playerId) return;
    const quantity = Math.max(0, Math.min(gangData[type], Math.floor(requestedQuantity)));
    if (quantity <= 0) return;
    economyLock.current = true;
    setEconomyBusy(true);
    try {
      const result = await sellGangMaterial(playerId, type, quantity, operationId(`sell_${type}`));
      setGangData((current) => applyRemoteGangData(current, result.gang));
      pushPopup(`+${result.payout.toLocaleString('en-US')} dirty`);
    } catch (error) {
      pushPopup(error instanceof Error ? error.message : 'Gang sell failed.');
    } finally {
      economyLock.current = false;
      setEconomyBusy(false);
    }
  };

  const transfer = async (currency: Currency, direction: 'deposit' | 'withdraw', amount: number) => {
    const safeAmount = Math.max(0, Math.floor(amount));
    if (safeAmount <= 0 || isBlocked() || !playerId) return;
    economyLock.current = true;
    setEconomyBusy(true);
    try {
      const result = await transferGangFunds(playerId, currency, direction, safeAmount, operationId(`funds_${currency}_${direction}`));
      setCashBalance(result.playerCleanMoney);
      setBaniMurdari(result.playerDirtyMoney);
      setGangData((current) => appendLog(applyRemoteGangData(current, result.gang), `${direction === 'deposit' ? 'Deposited' : 'Withdrew'} ${safeAmount.toLocaleString('en-US')} ${currency}.`, 'neutral'));
      window.dispatchEvent(new Event('cityflow-player-refresh'));
    } catch (error) {
      pushPopup(error instanceof Error ? error.message : 'Gang transfer failed.');
    } finally {
      economyLock.current = false;
      setEconomyBusy(false);
    }
  };

  const deposit = (currency: Currency, amount: number) => void transfer(currency, 'deposit', amount);
  const withdraw = (currency: Currency, amount: number) => void transfer(currency, 'withdraw', amount);

  const launder = async (amount: number) => {
    const safeAmount = Math.max(0, Math.floor(amount));
    if (safeAmount <= 0 || safeAmount > gangData.dirtyBalance || isBlocked() || !playerId) return;
    economyLock.current = true;
    setEconomyBusy(true);
    try {
      const result = await launderGangFunds(playerId, safeAmount, operationId('funds_launder'));
      setGangData((current) => appendLog(applyRemoteGangData(current, result.gang), `Laundered ${safeAmount.toLocaleString('en-US')} dirty into ${result.cleanGain.toLocaleString('en-US')} clean.`, 'neutral'));
      pushPopup(`+${result.cleanGain.toLocaleString('en-US')} clean`);
    } catch (error) {
      pushPopup(error instanceof Error ? error.message : 'Gang laundering failed.');
    } finally {
      economyLock.current = false;
      setEconomyBusy(false);
    }
  };

  return { economyBusy, startCollection, startMining, startTransport, startProcessing, sellMaterial, deposit, withdraw, launder };
}
