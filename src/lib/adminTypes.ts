import type { VipStatus } from './platformApi';

export type AdminPlayer = {
  playerId: string;
  accountId: number | null;
  username: string | null;
  email: string | null;
  displayName: string;
  cityLevel: number;
  cityXp: number;
  cleanMoney: number;
  flowCoins: number;
  rouletteFragments: number;
  vehicleSlotsBase: number;
  vehicleSlotsExtra: number;
  fleetValue: number;
  vehicleCount: number;
  inventoryUnits: number;
  netWorth: number;
  totalEarnings: number;
  careerScore: number;
  totalTimeHours: number;
  rouletteSpent: number;
  rouletteWon: number;
  totalNet: number;
  farmEarned: number;
  sleepCount: number;
  sleepMoney: number;
  pizzerLevel: number;
  pizzerXp: number;
  deliveries: number;
  pizzerEarnings: number;
  fisherLevel: number;
  fisherXp: number;
  catches: number;
  fisherEarnings: number;
  pilotLevel: number;
  pilotXp: number;
  flights: number;
  pilotEarnings: number;
  vipActive: boolean;
  hasGang: boolean;
  lastSeen: string | null;
  lastSeenMs: number;
  city: string | null;
  country: string | null;
  path: string | null;
};

export type AdminAction = {
  id: number;
  adminName: string;
  playerId: string | null;
  actionType: string;
  actionPayload: Record<string, unknown>;
  createdAt: string;
};

export type AdminOverviewResponse = {
  summary: {
    totalPlayers: number;
    totalAccounts: number;
    onlineNow: number;
    activeRecent: number;
    activeVip: number;
    totalGangs: number;
    totalCleanMoney: number;
    totalCityXp: number;
    totalFleetValue: number;
    totalEarnings: number;
  };
  levelDistribution: Array<{ level: number; count: number }>;
  topPlayers: AdminPlayer[];
  recentActions: AdminAction[];
};

export type AdminPlayersResponse = {
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  players: AdminPlayer[];
};

export type AdminPlayerDetail = {
  player: AdminPlayer;
  vip: VipStatus;
  boosts: Array<{ id: number; boostType: string; createdAt: string; expiresAt: string }>;
  inventory: Array<{ id: number; itemType: string; quantity: number; metadata: Record<string, unknown>; createdAt: string }>;
  vehicles: Array<{ id: number; brand: string; name: string; purchasePrice: number; purchaseSource: string; purchasedAt: string }>;
  gang: null | {
    name: string;
    gangLevel: string;
    membersCount: number;
    dirtyEarned: number;
    stockValue: number;
  };
};


export type AdminPlayerFilters = {
  search: string;
  accountOnly: boolean;
  onlineOnly: boolean;
  vipOnly: boolean;
  gangOnly: boolean;
  minLevel: string;
  maxLevel: string;
  minCityXp: string;
  maxCityXp: string;
  minMoney: string;
  maxMoney: string;
  minNetWorth: string;
  maxNetWorth: string;
  minEarnings: string;
  maxEarnings: string;
  minCareer: string;
  maxCareer: string;
  minTime: string;
  maxTime: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  page: number;
  pageSize: number;
};
