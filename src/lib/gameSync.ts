const STORAGE_KEY = 'luck_game_state_v1';
const PLAYER_KEY = 'luck_player_id_v1';
const SALT = 'stifyy-ogromania-salt';

function signPayload(payload: unknown) {
  const raw = JSON.stringify(payload) + SALT;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  return String(hash);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || !parsed?.sig) return null;
    return signPayload(parsed.data) === parsed.sig ? parsed.data : null;
  } catch {
    return null;
  }
}

function getPlayerId() {
  let id = localStorage.getItem(PLAYER_KEY);
  if (id) return id;
  id = `player_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(PLAYER_KEY, id);
  return id;
}

function buildStatsPayload(state: Record<string, unknown>) {
  const cashAvailable = Number(state.cashBalance ?? 0);
  const spent = Number(state.rouletteSpent ?? 0);
  const won = Number(state.rouletteWon ?? 0);

  return {
    cashAvailable,
    rouletteSpent: spent,
    rouletteWon: won,
    totalNet: won - spent,
    timeSpent: Number(state.timeFarm ?? 0) + Number(state.timeSleep ?? 0),
    leavesCollected: Number(state.processedFrunze ?? 0),
    whiteProcessed: Number(state.processedWhite ?? 0),
    blueProcessed: Number(state.processedBlue ?? 0),
    sleepCount: Number(state.sleepCount ?? 0),
    sleepMoney: Number(state.sleepMoney ?? 0),
    timeFarm: Number(state.timeFarm ?? 0),
    timeSleep: Number(state.timeSleep ?? 0),
  };
}

export function startGameSync() {
  const playerId = getPlayerId();
  let lastHash = '';

  const heartbeat = () => {
    fetch('/api/activity/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => {});
  };

  const syncStats = () => {
    const state = loadState();
    if (!state) return;

    const stats = buildStatsPayload(state);
    const hash = signPayload(stats);
    if (hash === lastHash) return;
    lastHash = hash;

    fetch('/api/stats/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, stats, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => {});
  };

  heartbeat();
  syncStats();

  const heartbeatTimer = window.setInterval(heartbeat, 60_000);
  const syncTimer = window.setInterval(syncStats, 20_000);

  const onUnload = () => {
    heartbeat();
    syncStats();
  };

  window.addEventListener('beforeunload', onUnload);

  return () => {
    window.clearInterval(heartbeatTimer);
    window.clearInterval(syncTimer);
    window.removeEventListener('beforeunload', onUnload);
  };
}
