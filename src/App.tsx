import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import CityProgressHud from './components/city/CityProgressHud';
import CityTutorialOverlay from './components/city/CityTutorialOverlay';
import GangSyncBridge from './components/city/GangSyncBridge';
import LockedCareerPage from './components/city/LockedCareerPage';
import AppSidebar from './components/app/AppSidebar';
import MobileDock from './components/app/MobileDock';
import {
  GANG_ROUTES,
  NAV_GROUPS,
  accessPathForRoute,
  labelForRoute,
  normalizePath,
  type RoutePath,
} from './components/app/navigation';
import { usePlatformStatus } from './context/PlatformStatusContext';
import { usePlayer } from './hooks/usePlayer';
import { CAREER_REQUIREMENTS, careerAccessForPath, readPlayerCityProgress, type CityProgress } from './lib/cityProgress';
import { subscribeCityProgress } from './lib/cityProgressApi';
import { startGameSync } from './lib/gameSync';

const RouletteDemo = lazy(() => import('./components/RouletteDemo'));
const FarmatPage = lazy(() => import('./components/FarmatPage'));
const SleepPage = lazy(() => import('./components/SleepPage'));
const AdminPanelV2 = lazy(() => import('./components/AdminPanelV2'));
const PilotPage = lazy(() => import('./components/PilotPage'));
const PizzerPage = lazy(() => import('./components/PizzerPage'));
const FisherPage = lazy(() => import('./components/FisherPage'));
const GangsPage = lazy(() => import('./components/GangsPage'));
const CNNMarketplace = lazy(() => import('./components/CNNMarketplace'));
const ShowroomPage = lazy(() => import('./components/ShowroomPage'));
const InventoryPage = lazy(() => import('./components/InventoryPage'));
const MyProfilePage = lazy(() => import('./components/MyProfilePage'));
const CityHubPage = lazy(() => import('./components/CityHubPage'));
const LeaderboardsPage = lazy(() => import('./components/LeaderboardsPage'));

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

  const currentLabel = useMemo(() => labelForRoute(path), [path]);

  const renderPage = () => {
    const accessPath = accessPathForRoute(path);
    const requirement = CAREER_REQUIREMENTS[accessPath];
    const access = careerAccessForPath(accessPath, effectiveCityProgress);
    if (requirement && access && !access.unlocked) {
      const item = NAV_GROUPS.flatMap((group) => group.items).find((candidate) => candidate.path === path)
        || NAV_GROUPS.flatMap((group) => group.items).find((candidate) => candidate.path === accessPath);
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
    if (path.startsWith('/gangs')) return <GangsPage section={GANG_ROUTES[path] || 'overview'} onNavigate={navigateLoose} />;
    if (path === '/leaderboards') return <LeaderboardsPage />;
    if (path === '/cnn') return <CNNMarketplace />;
    if (path === '/adminpanelv2') return <AdminPanelV2 />;
    return <RouletteDemo />;
  };

  return (
    <div className="relative min-h-screen">
      <CityProgressHud currentLabel={currentLabel} onNavigate={navigateLoose} />
      <CityTutorialOverlay path={path} onNavigate={navigateLoose} />
      <GangSyncBridge />

      <AppSidebar
        path={path}
        open={menuOpen}
        progress={effectiveCityProgress}
        onNavigate={goTo}
        onClose={() => setMenuOpen(false)}
        onOpen={() => setMenuOpen(true)}
      />

      <MobileDock path={path} onNavigate={goTo} onOpenMenu={() => setMenuOpen(true)} />

      <main className="min-h-screen pb-20 pt-14 md:pb-0 md:pl-[272px] md:pt-0 lg:pl-[280px]">
        <div className="md:pt-20">
          <Suspense fallback={<PageFallback />}>{renderPage()}</Suspense>
        </div>
      </main>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="game-panel animate-pulse p-6" role="status" aria-live="polite">
        <div className="h-3 w-24 rounded-full bg-white/10" />
        <div className="mt-4 h-8 w-64 max-w-full rounded-xl bg-white/10" />
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="h-32 rounded-2xl bg-white/[0.06]" />
          <div className="h-32 rounded-2xl bg-white/[0.06]" />
          <div className="h-32 rounded-2xl bg-white/[0.06]" />
        </div>
        <span className="sr-only">Loading page</span>
      </div>
    </div>
  );
}
