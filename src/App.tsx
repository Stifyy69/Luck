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
import CityProgressHud from './components/city/CityProgressHud';
import CityTutorialOverlay from './components/city/CityTutorialOverlay';
import CityCayoProgressBridge from './components/city/CityCayoProgressBridge';
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
      <CityCayoProgressBridge />
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
        <div className="md:pt-20">{renderPage()}</div>
      </main>
    </div>
  );
}
