import { useEffect, useMemo, useState } from 'react';
import RouletteDemo from './components/RouletteDemo';
import FarmatPage from './components/FarmatPage';
import SleepPage from './components/SleepPage';
import AdminPanelV2 from './components/AdminPanelV2';
import PilotPage from './components/PilotPage';
import PizzerPage from './components/PizzerPage';
import FisherPage from './components/FisherPage';
import GangsPage from './components/GangsPage';
import CNNMarketplace from './components/CNNMarketplace';
import ShowroomPage from './components/ShowroomPage';
import InventoryPage from './components/InventoryPage';
import MyProfilePage from './components/MyProfilePage';
import CityHubPage from './components/CityHubPage';
import LeaderboardsPage from './components/LeaderboardsPage';
import AccountHud from './components/AccountHud';
import CityProgressHud from './components/city/CityProgressHud';
import CityTutorialOverlay from './components/city/CityTutorialOverlay';
import CityCayoProgressBridge from './components/city/CityCayoProgressBridge';
import GangSyncBridge from './components/city/GangSyncBridge';
import LockedCareerPage from './components/city/LockedCareerPage';
import CityIcon, { type CityIconName } from './components/ui/CityIcon';
import { usePlatformStatus } from './context/PlatformStatusContext';
import { usePlayer } from './hooks/usePlayer';
import { CAREER_REQUIREMENTS, careerAccessForPath, readPlayerCityProgress, type CityProgress } from './lib/cityProgress';
import { subscribeCityProgress } from './lib/cityProgressApi';
import { startGameSync } from './lib/gameSync';

type RoutePath = '/city' | '/ruleta' | '/farmat' | '/sleep' | '/pilot' | '/pizzer' | '/fisher' | '/showroom' | '/inventory' | '/owned' | '/profile' | '/cnn' | '/gangs' | '/leaderboards' | '/adminpanelv2';
type NavItem = { path: RoutePath; label: string; icon: CityIconName; hint?: string; unlockLevel?: number; vipOnly?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const VALID_ROUTES: RoutePath[] = ['/city', '/ruleta', '/farmat', '/sleep', '/pilot', '/pizzer', '/fisher', '/showroom', '/inventory', '/owned', '/profile', '/cnn', '/gangs', '/leaderboards', '/adminpanelv2'];
const NAV_GROUPS: NavGroup[] = [
  { label: 'Career', items: [
    { path: '/pizzer', label: 'Pizza Courier', icon: 'pizza', unlockLevel: 1 },
    { path: '/fisher', label: 'Fisher', icon: 'fish', unlockLevel: 3 },
    { path: '/pilot', label: 'Pilot', icon: 'plane', unlockLevel: 6 },
    { path: '/farmat', label: 'Cayo', icon: 'leaf', unlockLevel: 10 },
    { path: '/sleep', label: 'Night Shift', icon: 'moon', vipOnly: true },
  ] },
  { label: 'Assets', items: [
    { path: '/inventory', label: 'Inventory', icon: 'inventory' },
    { path: '/showroom', label: 'Showroom', icon: 'car' },
    { path: '/cnn', label: 'CNN Market', icon: 'market' },
  ] },
  { label: 'City', items: [
    { path: '/leaderboards', label: 'Rankings', icon: 'leaderboard' },
    { path: '/ruleta', label: 'Roulette', icon: 'roulette' },
    { path: '/gangs', label: 'Gangs', icon: 'gangs', unlockLevel: 15 },
  ] },
];

function normalizePath(pathname: string): RoutePath {
  if (pathname === '/cars') return '/showroom';
  if (pathname === '/marketplace') return '/cnn';
  if (pathname === '/owned') return '/inventory';
  if (pathname === '/status') return '/profile';
  if (pathname === '/') return '/city';
  if (VALID_ROUTES.includes(pathname as RoutePath)) return pathname as RoutePath;
  return '/city';
}

export default function App() {
  const { player } = usePlayer();
  const { status } = usePlatformStatus();
  const playerCityProgress = readPlayerCityProgress(player);
  const [cityProgress, setCityProgress] = useState<CityProgress | null>(playerCityProgress);
  const [path, setPath] = useState<RoutePath>(normalizePath(window.location.pathname || '/city'));
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const nextPath = normalizePath(window.location.pathname || path);
    if (nextPath !== window.location.pathname) window.history.replaceState({}, '', nextPath);
    if (nextPath !== path) setPath(nextPath);
    const onPopState = () => setPath(normalizePath(window.location.pathname || '/city'));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [path]);

  useEffect(() => {
    const stop = startGameSync();
    return () => stop?.();
  }, []);

  useEffect(() => {
    if (playerCityProgress) setCityProgress(playerCityProgress);
  }, [playerCityProgress?.xp, playerCityProgress?.level, playerCityProgress?.vipActive]);

  useEffect(() => subscribeCityProgress(({ progress }) => setCityProgress(progress)), []);
  useEffect(() => setMenuOpen(false), [path]);

  const effectiveCityProgress = useMemo<CityProgress | null>(() => {
    if (!cityProgress) return null;
    const vipActive = status.vip.active;
    return {
      ...cityProgress,
      vipActive,
      careerAccess: {
        ...cityProgress.careerAccess,
        nightShift: {
          unlocked: vipActive,
          requiredLevel: null,
          vipOnly: true,
          reason: vipActive ? null : 'VIP access required',
        },
      },
    };
  }, [cityProgress, status.vip.active]);

  const goTo = (nextPath: RoutePath) => {
    if (nextPath === path) return;
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
  };

  const navigateLoose = (nextPath: string) => goTo(normalizePath(nextPath));

  const currentLabel = useMemo(() => {
    if (path === '/city') return 'City Hub';
    if (path === '/profile') return 'My Profile';
    if (path === '/leaderboards') return 'Rankings';
    if (path === '/adminpanelv2') return 'Control Center';
    return NAV_GROUPS.flatMap((group) => group.items).find((item) => item.path === path)?.label || 'CityFlow';
  }, [path]);

  const renderPage = () => {
    const requirement = CAREER_REQUIREMENTS[path];
    const access = careerAccessForPath(path, effectiveCityProgress);
    if (requirement && access && !access.unlocked) {
      const item = NAV_GROUPS.flatMap((group) => group.items).find((candidate) => candidate.path === path);
      return (
        <LockedCareerPage
          label={requirement.label}
          icon={item?.icon || 'alert'}
          requiredLevel={requirement.level}
          vipOnly={requirement.vipOnly}
          progress={effectiveCityProgress}
          onNavigate={navigateLoose}
          recommendedPath={requirement.recommendedPath}
        />
      );
    }

    if (path === '/city') return <CityHubPage onNavigate={(nextPath) => goTo(nextPath)} />;
    if (path === '/farmat') return <FarmatPage />;
    if (path === '/sleep') return <SleepPage />;
    if (path === '/pilot') return <PilotPage />;
    if (path === '/pizzer') return <PizzerPage />;
    if (path === '/fisher') return <FisherPage />;
    if (path === '/showroom') return <ShowroomPage />;
    if (path === '/inventory' || path === '/owned') return <InventoryPage />;
    if (path === '/profile') return <MyProfilePage />;
    if (path === '/gangs') return <GangsPage />;
    if (path === '/leaderboards') return <LeaderboardsPage />;
    if (path === '/cnn') return <CNNMarketplace />;
    if (path === '/adminpanelv2') return <AdminPanelV2 />;
    return <RouletteDemo />;
  };

  return (
    <div className="relative min-h-screen">
      <CityProgressHud currentLabel={currentLabel} onNavigate={navigateLoose} />
      <AccountHud />
      <CityTutorialOverlay path={path} onNavigate={navigateLoose} />
      <CityCayoProgressBridge />
      <GangSyncBridge />

      {menuOpen && <button type="button" aria-label="Close navigation overlay" className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm md:hidden" onClick={() => setMenuOpen(false)} />}

      <button type="button" onClick={() => setMenuOpen((current) => !current)} className="game-panel fixed left-4 top-4 z-[75] inline-flex h-10 w-10 items-center justify-center text-white md:hidden" aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
        <CityIcon name={menuOpen ? 'close' : 'menu'} className="h-5 w-5" />
      </button>

      <aside className={`game-scrollbar fixed inset-y-0 left-0 z-[70] flex w-[270px] flex-col overflow-y-auto border-r border-white/[0.07] bg-[#0b0e13]/[0.97] px-4 pb-5 pt-5 shadow-[30px_0_80px_rgba(0,0,0,0.32)] backdrop-blur-xl transition-transform duration-200 md:left-4 md:top-4 md:h-[calc(100vh-2rem)] md:w-[244px] md:rounded-[24px] md:border ${menuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex items-center gap-3 px-2 pb-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#d8ff63] text-sm font-black tracking-[-0.08em] text-[#101506]">CF</div>
          <div className="min-w-0">
            <p className="truncate text-base font-black tracking-[-0.035em] text-white">CityFlow</p>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-[#d8ff63]/70">No-RP mobile life</p>
          </div>
        </div>

        <div className="space-y-1">
          <button type="button" onClick={() => goTo('/city')} className={`game-nav-item flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ${path === '/city' ? 'game-nav-item-active' : ''}`}>
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${path === '/city' ? 'bg-[#d8ff63]/10 text-[#d8ff63]' : 'bg-white/[0.025] text-white/45'}`}><CityIcon name="home" className="h-[18px] w-[18px]" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">City Hub</span><span className="block text-[10px] text-white/25">Next move and activity</span></span>
          </button>

          <button type="button" onClick={() => goTo('/profile')} className={`game-nav-item flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ${path === '/profile' ? 'game-nav-item-active' : ''}`}>
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${path === '/profile' ? 'bg-[#d8ff63]/10 text-[#d8ff63]' : 'bg-white/[0.025] text-white/45'}`}><CityIcon name="profile" className="h-[18px] w-[18px]" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">My Profile</span><span className="block text-[10px] text-white/25">Identity and progress</span></span>
          </button>
        </div>

        <nav className="mt-5 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-[9px] font-extrabold uppercase tracking-[0.2em] text-white/22">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = path === item.path;
                  const access = careerAccessForPath(item.path, effectiveCityProgress);
                  const locked = Boolean(access && !access.unlocked);
                  return (
                    <button key={item.path} type="button" onClick={() => goTo(item.path)} className={`game-nav-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${active ? 'game-nav-item-active' : ''} ${locked ? 'opacity-55' : ''}`}>
                      <CityIcon name={item.icon} className="h-[17px] w-[17px] shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-xs font-bold">{item.label}</span>
                      {locked ? (
                        <span className="rounded-full border border-white/[0.08] bg-black/25 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] text-white/35">{item.vipOnly ? 'VIP' : `Lv ${item.unlockLevel}`}</span>
                      ) : item.hint ? (
                        <span className="rounded-full bg-[#d8ff63]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] text-[#d8ff63]">{item.hint}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto pt-6">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5">
            <div className="flex items-center justify-between gap-2 text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#d8ff63]/70"><span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#65e6a5]" />City Level {effectiveCityProgress?.level || 1}</span><span>{effectiveCityProgress?.xp || 0} XP</span></div>
            <p className="mt-2 text-[11px] leading-4 text-white/35">Complete careers to open the rest of the city.</p>
          </div>
        </div>
      </aside>

      <main className="min-h-screen pt-14 md:pl-[272px] md:pt-0 lg:pl-[278px]">
        <div className="lg:pt-20">{renderPage()}</div>
      </main>
    </div>
  );
}
