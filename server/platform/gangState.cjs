const crypto = require('crypto');

const SELL_PRICES = Object.freeze({ blue: 2_300, gunpowder: 5_000, steel: 6_000 });
const STOCK_KEYS = Object.freeze(['leaves', 'white', 'blue', 'sulfur', 'ironOre', 'gunpowder', 'steel']);

const RECIPES = Object.freeze({
  white: { input: 'leaves', inputPerBatch: 1_200, output: 'white', outputPerBatch: 400, dirtyCost: 900_000, activity: 'white' },
  blue: { input: 'white', inputPerBatch: 400, output: 'blue', outputPerBatch: 800, dirtyCost: 100_000, activity: 'blue' },
  gunpowder: { input: 'sulfur', inputPerBatch: 5, output: 'gunpowder', outputPerBatch: 1, dirtyCost: 0, activity: 'gunpowder' },
  steel: { input: 'ironOre', inputPerBatch: 5, output: 'steel', outputPerBatch: 1, dirtyCost: 0, activity: 'steel' },
});

const UPGRADE_COSTS = Object.freeze([
  { dirty: 300_000_000, leaves: 10_000, white: 10_000, blue: 10_000 },
  { dirty: 1_000_000_000, leaves: 50_000, white: 50_000, blue: 50_000 },
  { dirty: 10_000_000_000, leaves: 200_000, white: 200_000, blue: 200_000 },
]);

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function defaultGangState(name = '') {
  return {
    name,
    level: 1,
    cleanBalance: 0,
    dirtyBalance: 0,
    totalDirtyEarned: 0,
    battleReputation: 0,
    stockValue: 0,
    resources: Object.fromEntries(STOCK_KEYS.map((key) => [key, 0])),
    members: [],
    activityLog: [],
  };
}

function normalizeGangState(input) {
  const source = input && typeof input === 'object' ? input : {};
  const legacyResources = {
    leaves: source.frunze,
    white: source.white,
    blue: source.blue,
  };
  const state = {
    ...defaultGangState(String(source.name || '')),
    ...source,
    name: String(source.name || ''),
    level: Math.min(4, Math.max(1, Math.floor(number(source.level, 1)))),
    cleanBalance: number(source.cleanBalance),
    dirtyBalance: number(source.dirtyBalance),
    totalDirtyEarned: number(source.totalDirtyEarned ?? source.dirtyEarned),
    battleReputation: number(source.battleReputation),
    resources: Object.fromEntries(STOCK_KEYS.map((key) => [key, number(source.resources?.[key] ?? legacyResources[key])])),
    members: Array.isArray(source.members) ? source.members : [],
    activityLog: Array.isArray(source.activityLog) ? source.activityLog.slice(0, 100) : [],
  };
  state.stockValue = calculateStockValue(state.resources);
  return state;
}

function calculateStockValue(resources) {
  return Math.floor(STOCK_KEYS.reduce((sum, key) => sum + number(resources[key]) * (SELL_PRICES[key] || 0), 0));
}

function appendLog(state, type, message, details = {}) {
  state.activityLog = [{ id: crypto.randomUUID(), type, message, details, createdAt: new Date().toISOString() }, ...state.activityLog].slice(0, 100);
}

const SKILL_MAPPING = Object.freeze({
  white: ['streetSmart', 'leadership'], blue: ['streetSmart', 'leadership'],
  gunpowder: ['tactics', 'streetSmart'], steel: ['tactics', 'streetSmart'],
});

function awardWorkProgress(state, activity, xpAward) {
  const participant = state.members.find((member) => member && typeof member === 'object' && member.status !== 'Injured');
  if (!participant) return null;
  const previousActivity = participant.fatigue?.activity;
  const previousCount = Number(participant.fatigue?.count || 0);
  if (previousActivity === activity && previousCount >= 1) {
    participant.loyalty = Math.max(0, number(participant.loyalty) - 5);
    participant.fatigue = { activity, count: 0 };
  } else {
    participant.fatigue = { activity, count: previousActivity === activity ? previousCount + 1 : 1 };
  }
  participant.lastWork = activity;
  participant.xp = number(participant.xp) + xpAward;
  participant.level = Math.max(1, Math.floor(number(participant.level, 1)));
  participant.xpNeeded = Math.max(100, Math.floor(number(participant.xpNeeded, 100)));
  participant.skills = participant.skills && typeof participant.skills === 'object' ? participant.skills : {};
  while (participant.xp >= participant.xpNeeded) {
    participant.xp -= participant.xpNeeded;
    participant.level += 1;
    participant.xpNeeded = Math.floor(participant.xpNeeded * 1.15);
    const [primary, secondary] = SKILL_MAPPING[activity] || [];
    if (primary) participant.skills[primary] = Math.min(100, number(participant.skills[primary]) + 2);
    if (secondary) participant.skills[secondary] = Math.min(100, number(participant.skills[secondary]) + 1);
  }
  return participant.id || participant.displayName || null;
}

function applySell(inputState, material, requestedQuantity) {
  if (!Object.hasOwn(SELL_PRICES, material)) throw new Error('Material invalid.');
  const state = normalizeGangState(inputState);
  const available = Math.floor(state.resources[material]);
  const quantity = requestedQuantity === 'all' ? available : Math.floor(Number(requestedQuantity));
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Cantitatea trebuie să fie un număr întreg pozitiv sau all.');
  if (quantity > available) throw new Error('Stock insuficient.');
  const payout = quantity * SELL_PRICES[material];
  state.resources[material] -= quantity;
  state.dirtyBalance += payout;
  state.totalDirtyEarned += payout;
  state.stockValue = calculateStockValue(state.resources);
  appendLog(state, 'sell', `Vândut ${quantity} ${material} pentru ${payout} dirty.`, { material, quantity, payout });
  return { state, payout, quantity };
}

function applyProcess(inputState, recipeKey, batchesValue, options = {}) {
  const recipe = RECIPES[recipeKey];
  if (!recipe) throw new Error('Rețetă invalidă.');
  const batches = Math.floor(Number(batchesValue));
  if (!Number.isSafeInteger(batches) || batches <= 0) throw new Error('Numărul de batch-uri trebuie să fie întreg și pozitiv.');
  const state = normalizeGangState(inputState);
  const inputUsed = batches * recipe.inputPerBatch;
  const dirtyCost = batches * recipe.dirtyCost;
  if (state.resources[recipe.input] < inputUsed) throw new Error('Materiale insuficiente.');
  if (state.dirtyBalance < dirtyCost) throw new Error('Gang Dirty Balance insuficient.');
  state.resources[recipe.input] -= inputUsed;
  state.dirtyBalance -= dirtyCost;
  const raided = options.forceRaid === true || (options.forceRaid !== false && Math.random() < Number(options.raidChance ?? 0.05));
  const outputAdded = raided ? 0 : batches * recipe.outputPerBatch;
  if (!raided) state.resources[recipe.output] += outputAdded;
  const participantId = awardWorkProgress(state, recipe.activity, Math.max(10, batches * 2));
  state.stockValue = calculateStockValue(state.resources);
  appendLog(state, 'process', raided ? `Raid: pierdut inputul pentru ${batches} batch-uri ${recipeKey}.` : `Procesat ${batches} batch-uri ${recipeKey}.`, { recipe: recipeKey, batches, inputUsed, outputAdded, dirtyCost, raided });
  return { state, recipe, batches, inputUsed, outputAdded, dirtyCost, raided, participantId };
}

module.exports = { RECIPES, SELL_PRICES, STOCK_KEYS, UPGRADE_COSTS, applyProcess, applySell, awardWorkProgress, calculateStockValue, defaultGangState, normalizeGangState };
