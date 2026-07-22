import type { GangSection } from '../GangsPage';
import type { CityIconName } from '../ui/CityIcon';

export type RoutePath =
  | '/city' | '/ruleta' | '/farmat' | '/sleep' | '/pilot' | '/pizzer' | '/fisher'
  | '/showroom' | '/inventory' | '/owned' | '/profile' | '/cnn' | '/leaderboards' | '/adminpanelv2'
  | '/gangs' | '/gangs/work' | '/gangs/members' | '/gangs/recruitment' | '/gangs/storage' | '/gangs/finance' | '/gangs/battles';

export type NavItem = {
  path: RoutePath;
  label: string;
  description: string;
  icon: CityIconName;
  hint?: string;
  unlockLevel?: number;
  vipOnly?: boolean;
};

export type NavGroup = { label: string; items: NavItem[] };

export const GANG_ROUTES: Record<string, GangSection> = {
  '/gangs': 'overview',
  '/gangs/work': 'work',
  '/gangs/members': 'members',
  '/gangs/recruitment': 'recruitment',
  '/gangs/storage': 'storage',
  '/gangs/finance': 'finance',
  '/gangs/battles': 'battles',
};

export const NAV_GROUPS: NavGroup[] = [
  { label: 'Career', items: [
    { path: '/pizzer', label: 'Pizza Courier', description: 'Fast city deliveries', icon: 'pizza', unlockLevel: 1 },
    { path: '/fisher', label: 'Fisher', description: 'Catch and sell', icon: 'fish', unlockLevel: 3 },
    { path: '/pilot', label: 'Pilot', description: 'High-value routes', icon: 'plane', unlockLevel: 6 },
    { path: '/farmat', label: 'Cayo Operations', description: 'Build the supply chain', icon: 'leaf', unlockLevel: 10 },
    { path: '/sleep', label: 'Night Shift', description: 'Passive VIP income', icon: 'moon', vipOnly: true },
  ] },
  { label: 'Assets', items: [
    { path: '/inventory', label: 'Inventory', description: 'Vehicles and items', icon: 'inventory' },
    { path: '/showroom', label: 'Showroom', description: 'Discover new cars', icon: 'car' },
    { path: '/cnn', label: 'CNN Market', description: 'Trade with the city', icon: 'market' },
  ] },
  { label: 'City', items: [
    { path: '/leaderboards', label: 'Rankings', description: 'Top city players', icon: 'leaderboard' },
    { path: '/ruleta', label: 'Roulette', description: 'Premium rewards', icon: 'roulette' },
  ] },
  { label: 'Gang', items: [
    { path: '/gangs', label: 'Overview', description: 'Command center', icon: 'gangs', unlockLevel: 15 },
    { path: '/gangs/work', label: 'Operations', description: 'Production and sales', icon: 'leaf', unlockLevel: 15 },
    { path: '/gangs/members', label: 'Members', description: 'Manage your crew', icon: 'profile', unlockLevel: 15 },
    { path: '/gangs/recruitment', label: 'Recruitment', description: 'Grow the organization', icon: 'gangs', unlockLevel: 15 },
    { path: '/gangs/storage', label: 'Storage', description: 'Stock and capacity', icon: 'inventory', unlockLevel: 15 },
    { path: '/gangs/finance', label: 'Finance', description: 'Cash flow', icon: 'market', unlockLevel: 15 },
    { path: '/gangs/battles', label: 'Battles', description: 'Control city zones', icon: 'alert', unlockLevel: 15 },
  ] },
];

const VALID_ROUTES = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.path)).concat([
  '/city',
  '/profile',
  '/adminpanelv2',
] as RoutePath[]);

export function normalizePath(pathname: string): RoutePath {
  if (pathname === '/cars') return '/showroom';
  if (pathname === '/marketplace') return '/cnn';
  if (pathname === '/owned') return '/inventory';
  if (pathname === '/status') return '/profile';
  if (pathname === '/') return '/city';
  if (VALID_ROUTES.includes(pathname as RoutePath)) return pathname as RoutePath;
  return '/city';
}

export function accessPathForRoute(path: RoutePath) {
  return path.startsWith('/gangs') ? '/gangs' : path;
}

export function labelForRoute(path: RoutePath) {
  if (path === '/city') return 'City Hub';
  if (path === '/profile') return 'My Profile';
  if (path === '/adminpanelv2') return 'Control Center';
  return NAV_GROUPS.flatMap((group) => group.items).find((item) => item.path === path)?.label || 'CityFlow';
}
