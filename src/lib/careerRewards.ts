export type CareerRewardKind = 'PIZZER' | 'FISHER_CATCH' | 'FISHER_SALE' | 'PILOT' | 'CAYO_SALE' | 'CAYO_CONVERT';

export type CareerRewardReceipt = {
  id: string;
  kind: CareerRewardKind;
  title: string;
  money?: number;
  moneyType?: 'clean' | 'dirty' | 'carry';
  careerXp?: number;
  careerLabel?: string;
  detail?: string;
};

const EVENT_NAME = 'career-reward-confirmed';

function rewardId(kind: CareerRewardKind) {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${kind}_${suffix}`;
}

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function exactXpDelta(progression: unknown, fallback: unknown = 0) {
  const value = progression && typeof progression === 'object'
    ? progression as { xpBefore?: unknown; xpAfter?: unknown }
    : {};
  const before = safeNumber(value.xpBefore);
  const after = safeNumber(value.xpAfter);
  if (after >= before && (after > 0 || before > 0)) return Math.max(0, Math.floor(after - before));
  return Math.max(0, Math.floor(safeNumber(fallback)));
}

export function publishCareerReward(receipt: Omit<CareerRewardReceipt, 'id'>) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<CareerRewardReceipt>(EVENT_NAME, {
    detail: { ...receipt, id: rewardId(receipt.kind) },
  }));
}

export function subscribeCareerRewards(listener: (receipt: CareerRewardReceipt) => void) {
  const handler = (event: Event) => {
    const receipt = (event as CustomEvent<CareerRewardReceipt>).detail;
    if (receipt?.id) listener(receipt);
  };
  window.addEventListener(EVENT_NAME, handler as EventListener);
  return () => window.removeEventListener(EVENT_NAME, handler as EventListener);
}

type UnknownRecord = Record<string, any>;

export function publishPizzerReward(payload: UnknownRecord) {
  const result = payload?.result;
  if (!result?.delivered || result?.accident) return;
  publishCareerReward({
    kind: 'PIZZER',
    title: 'Pizza run confirmed',
    money: Math.max(0, Math.floor(safeNumber(result.breakdown?.totalReward))),
    moneyType: 'clean',
    careerXp: exactXpDelta(result.progression, result.breakdown?.xpGained),
    careerLabel: 'Courier XP',
  });
}

export function publishFisherCatchReward(payload: UnknownRecord) {
  const result = payload?.result || payload?.lastResult || payload?.state?.lastResult;
  if (!result?.caught) return;
  publishCareerReward({
    kind: 'FISHER_CATCH',
    title: 'Catch confirmed',
    money: Math.max(0, Math.floor(safeNumber(result.breakdown?.totalReward))),
    moneyType: 'carry',
    careerXp: exactXpDelta(result.progression, result.breakdown?.xpGained),
    careerLabel: 'Fisher XP',
    detail: 'The fish value is stored in your carry. Sell the carry to receive clean money.',
  });
}

export function publishFisherSaleReward(payload: UnknownRecord) {
  const soldValue = Math.max(0, Math.floor(safeNumber(payload?.soldValue)));
  if (!soldValue) return;
  publishCareerReward({
    kind: 'FISHER_SALE',
    title: 'Catch sold',
    money: soldValue,
    moneyType: 'clean',
    detail: 'The exact server payout was added to your clean balance.',
  });
}

export function publishPilotReward(payload: UnknownRecord) {
  const result = payload?.result;
  if (!result?.completed) return;
  publishCareerReward({
    kind: 'PILOT',
    title: 'Flight confirmed',
    money: Math.max(0, Math.floor(safeNumber(result.breakdown?.totalCash))),
    moneyType: 'clean',
    careerXp: exactXpDelta(result.progression, result.breakdown?.totalXp),
    careerLabel: 'Pilot XP',
  });
}

export function publishCayoSaleReward(payload: UnknownRecord) {
  const payout = Math.max(0, Math.floor(safeNumber(payload?.payout)));
  if (!payout || payload?.raided) return;
  publishCareerReward({
    kind: 'CAYO_SALE',
    title: 'Cayo sale confirmed',
    money: payout,
    moneyType: 'dirty',
  });
}

export function publishCayoConversionReward(payload: UnknownRecord) {
  const cleanGained = Math.max(0, Math.floor(safeNumber(payload?.cleanGained)));
  if (!cleanGained) return;
  publishCareerReward({
    kind: 'CAYO_CONVERT',
    title: 'Cayo conversion confirmed',
    money: cleanGained,
    moneyType: 'clean',
  });
}
