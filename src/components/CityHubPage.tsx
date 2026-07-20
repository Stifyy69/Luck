import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { api } from '../lib/api';
import { dismissCityOnboarding, readCityOnboarding } from '../lib/cityOnboarding';
import {
  readCityActivity,
  recordCityActivity,
  subscribeCityActivity,
  type CityActivityEntry,
  type CityActivityTone,
} from '../lib/cityActivity';
import type { FisherStateResponse, PilotStateResponse, PizzerStateResponse } from '../types/game';
import CityIcon, { type CityIconName } from './ui/CityIcon';

type HubRoute = '/profile' | '/pizzer' | '/pilot' | '/fisher' | '/showroom' | '/inventory' | '/cnn';
type CityHubPageProps = { onNavigate: (path: HubRoute) => void };

type Objective = {
  kicker: string;
  title: string;
  description: string;
  progress: number;
  progressLabel: string;
  action: string;
  path: HubRoute;
  icon: CityIconName;
};

function fmt(value: number) {
  return Math.max(0, Number(value || 0)).toLocaleString('en-US');
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function greetingForHour(hour: number) {
  if (hour < 5) return 'Still moving';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function relativeTime(timestamp: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 45) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function toneClasses(tone: CityActivityTone) {
  if (tone === 'money') return 'bg-[rgba(114,227,154,0.08)] text-[var(--money)] border-[rgba(114,227,154,0.18)]';
  if (tone === 'info') return 'bg-[rgba(114,183,255,0.08)] text-[var(--info)] border-[rgba(114,183,255,0.18)]';
  if (tone === 'warning') return 'bg-[rgba(240,196,106,0.08)] text-[var(--warning)] border-[rgba(240,196,106,0.18)]';
  if (tone === 'danger') return 'bg-[rgba(255,107,114,0.08)] text-[var(--danger)] border-[rgba(255,107,114,0.18)]';
  return 'bg-[rgba(211,255,81,0.08)] text-[var(--accent)] border-[rgba(211,255,81,0.18)]';
}

export default function CityHubPage({ onNavigate }: CityHubPageProps) {
  const { playerId, player, loading: playerLoading, error: playerError, refresh } = usePlayer();
  const [pizzer, setPizzer] = useState<PizzerStateResponse | null>(null);
  const [pilot, setPilot] = useState<PilotStateResponse | null>(null);
  const [fisher, setFisher] = useState<FisherStateResponse | null>(null);
  const [activities, setActivities] = useState<CityActivityEntry[]>([]);
  const [loadingCareers, setLoadingCareers] = useState(true);
  const [careerError, setCareerError] = useState<string | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const loadHub = useCallback(async () => {
    setLoadingCareers(true);
    setCareerError(null);

    const [pizzerResult, pilotResult, fisherResult] = await Promise.allSettled([
      api.pizzerState(playerId),
      api.pilotState(playerId),
      api.fisherState(playerId),
    ]);

    if (pizzerResult.status === 'fulfilled') setPizzer(pizzerResult.value);
    if (pilotResult.status === 'fulfilled') setPilot(pilotResult.value);
    if (fisherResult.status === 'fulfilled') setFisher(fisherResult.value);

    const rejected = [pizzerResult, pilotResult, fisherResult].filter((result) => result.status === 'rejected');
    if (rejected.length === 3) setCareerError('Career progress could not be loaded.');
    setLoadingCareers(false);
  }, [playerId]);

  useEffect(() => {
    loadHub().catch(() => setCareerError('Career progress could not be loaded.'));
    setOnboardingDismissed(Boolean(readCityOnboarding(playerId).dismissedAt));
  }, [loadHub, playerId]);

  useEffect(() => {
    setActivities(readCityActivity(playerId));
    return subscribeCityActivity(playerId, () => setActivities(readCityActivity(playerId)));
  }, [playerId]);

  useEffect(() => {
    if (pizzer?.lastResult) {
      const result = pizzer.lastResult;
      recordCityActivity(playerId, {
        dedupeKey: `pizzer:${pizzer.progress.totalDeliveries}:${result.breakdown.rating}:${result.breakdown.totalReward}`,
        icon: 'pizza',
        tone: result.delivered ? 'money' : 'danger',
        title: result.delivered ? 'Pizza delivery completed' : 'Pizza delivery failed',
        detail: `${result.orderType} run · ${result.breakdown.rating}`,
        amount: result.breakdown.totalReward,
        xp: result.breakdown.xpGained,
      });
    }

    if (pilot?.lastResult) {
      const result = pilot.lastResult;
      recordCityActivity(playerId, {
        dedupeKey: `pilot:${pilot.progress.totalFlights}:${result.routeId}:${result.breakdown.totalCash}`,
        icon: 'plane',
        tone: result.completed ? 'info' : 'danger',
        title: result.completed ? 'Pilot route completed' : 'Pilot route ended',
        detail: result.completed ? `${result.routeId.replace('_', ' ')} flight report` : result.failReason || 'Flight cancelled',
        amount: result.breakdown.totalCash,
        xp: result.breakdown.totalXp,
      });
    }

    if (fisher?.lastResult) {
      const result = fisher.lastResult;
      recordCityActivity(playerId, {
        dedupeKey: `fisher:${fisher.progress.totalCatches}:${result.fishName || 'failed'}:${result.breakdown.totalReward}`,
        icon: 'fish',
        tone: result.caught ? 'accent' : 'danger',
        title: result.caught ? `${result.fishName || 'Fish'} landed` : 'Catch missed',
        detail: result.caught ? `${result.fishRarity || 'COMMON'} · ${result.fishWeightKg || 0}kg` : result.failReason || 'The fish escaped',
        amount: result.breakdown.totalReward,
        xp: result.breakdown.xpGained,
      });
    }

    setActivities(readCityActivity(playerId));
  }, [fisher, pilot, pizzer, playerId]);

  const displayName = String(player?.displayName || player?.playerId || 'Citizen');
  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);
  const deliveries = Number(pizzer?.progress.totalDeliveries || 0);
  const courierLevel = Number(pizzer?.progress.level || 1);
  const pilotLevel = Number(pilot?.progress.level || 1);
  const fisherLevel = Number(fisher?.progress.level || 1);
  const profileReady = Boolean(String(player?.displayName || '').trim());
  const courierStarted = deliveries > 0 || Boolean(pizzer && pizzer.shiftState !== 'IDLE');
  const firstDeliveryComplete = deliveries > 0;
  const onboardingSteps = [profileReady, courierStarted, firstDeliveryComplete];
  const onboardingCompletedCount = onboardingSteps.filter(Boolean).length;
  const onboardingComplete = firstDeliveryComplete;
  const showOnboarding = !onboardingDismissed;
  const currentVehicle = pizzer?.vehicleLabel || (courierLevel >= 34 ? 'Delivery Car' : courierLevel >= 17 ? 'Scooter Courier' : 'Bicycle Courier');

  const objective = useMemo<Objective>(() => {
    if (!profileReady) {
      return {
        kicker: 'Identity required',
        title: 'Choose your city name',
        description: 'Your profile name appears across careers, rankings and future social systems.',
        progress: 0,
        progressLabel: 'Profile incomplete',
        action: 'Open profile',
        path: '/profile',
        icon: 'profile',
      };
    }

    if (!firstDeliveryComplete) {
      return {
        kicker: 'First city objective',
        title: 'Complete your first pizza run',
        description: 'Start with the Bicycle Courier, accept a contract and finish the customer handoff.',
        progress: courierStarted ? 55 : 15,
        progressLabel: courierStarted ? 'Shift started · delivery pending' : 'Bicycle ready · dispatch waiting',
        action: courierStarted ? 'Continue first run' : 'Start first run',
        path: '/pizzer',
        icon: 'pizza',
      };
    }

    if (courierLevel < 17) {
      return {
        kicker: 'Next vehicle unlock',
        title: 'Reach Courier Level 17',
        description: 'The Scooter Courier opens faster city routes and urgent contracts.',
        progress: clampPercent((courierLevel / 17) * 100),
        progressLabel: `Courier Lv. ${courierLevel} / 17`,
        action: 'Continue courier career',
        path: '/pizzer',
        icon: 'pizza',
      };
    }

    if ((player?.ownedVehicles.length || 0) === 0) {
      return {
        kicker: 'Asset objective',
        title: 'Buy your first personal vehicle',
        description: 'Turn job income into a visible city asset and begin building your garage value.',
        progress: 0,
        progressLabel: `${fmt(player?.cleanMoney || 0)} $ available`,
        action: 'Visit showroom',
        path: '/showroom',
        icon: 'car',
      };
    }

    if (pilotLevel < 10) {
      return {
        kicker: 'Career expansion',
        title: 'Reach Pilot Level 10',
        description: 'Unlock the Farm Fertilizer route and grow a second source of income.',
        progress: clampPercent((pilotLevel / 10) * 100),
        progressLabel: `Pilot Lv. ${pilotLevel} / 10`,
        action: 'Open pilot career',
        path: '/pilot',
        icon: 'plane',
      };
    }

    return {
      kicker: 'City growth',
      title: 'Build your market value',
      description: 'Use careers, vehicles and inventory to grow a stronger position in the city economy.',
      progress: clampPercent(Math.min(100, (player?.ownedVehicles.length || 0) * 18 + (player?.inventory.length || 0) * 5)),
      progressLabel: `${player?.ownedVehicles.length || 0} vehicles · ${player?.inventory.length || 0} inventory stacks`,
      action: 'Open CNN Market',
      path: '/cnn',
      icon: 'market',
    };
  }, [courierLevel, courierStarted, firstDeliveryComplete, pilotLevel, player, profileReady]);

  const dismissOnboarding = () => {
    dismissCityOnboarding(playerId);
    setOnboardingDismissed(true);
  };

  const reload = () => {
    refresh();
    loadHub().catch(() => setCareerError('Career progress could not be loaded.'));
  };

  return (
    <div className="min-h-screen px-4 pb-10 pt-20 sm:px-6 md:px-8 md:pb-12 md:pt-8">
      <div className="mx-auto max-w-[1220px] space-y-5">
        <section className="game-panel relative overflow-hidden p-5 sm:p-7 lg:p-8">
          <div className="pointer-events-none absolute right-[-140px] top-[-180px] h-[430px] w-[430px] rounded-full bg-[var(--accent)] opacity-[0.055] blur-3xl" />
          <div className="relative grid gap-7 lg:grid-cols-[1.12fr_0.88fr] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="section-kicker">City hub</p>
                <span className="rounded-full border border-[rgba(114,227,154,0.2)] bg-[rgba(114,227,154,0.06)] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-[var(--money)]">City online</span>
              </div>
              <h1 className="display-title mt-5">{greeting}, {displayName}.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/43">Your careers, money and next objective now meet in one place. Continue the most useful action instead of searching through every page.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button type="button" onClick={() => onNavigate(objective.path)} className="btn-primary rounded-2xl px-6 py-3.5 text-sm">{objective.action}</button>
                <button type="button" onClick={reload} disabled={playerLoading || loadingCareers} className="btn-ghost rounded-2xl px-4 py-3.5 text-sm disabled:opacity-40">
                  <span className="inline-flex items-center gap-2"><CityIcon name="refresh" className="h-4 w-4" />Refresh city</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
              <HubStat icon="wallet" label="Clean money" value={`${fmt(player?.cleanMoney || 0)} $`} tone="money" />
              <HubStat icon="car" label="Current ride" value={currentVehicle} />
              <HubStat icon="garage" label="Owned vehicles" value={String(player?.ownedVehicles.length || 0)} />
              <HubStat icon="inventory" label="Inventory stacks" value={String(player?.inventory.length || 0)} />
            </div>
          </div>
        </section>

        {(playerError || careerError) && (
          <section className="rounded-[20px] border border-red-400/20 bg-red-500/[0.055] p-4 text-sm font-bold text-red-100">
            {playerError || careerError}
          </section>
        )}

        {showOnboarding && (
          <section className={`game-panel-soft overflow-hidden ${onboardingComplete ? 'border-[rgba(114,227,154,0.2)]' : ''}`}>
            <div className="grid lg:grid-cols-[0.82fr_1.18fr]">
              <div className="border-b border-white/[0.07] bg-black/20 p-6 sm:p-7 lg:border-b-0 lg:border-r">
                <p className="section-kicker">First city run</p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white">{onboardingComplete ? 'Your city life is active.' : 'Complete the first delivery.'}</h2>
                <p className="mt-3 text-sm leading-relaxed text-white/40">{onboardingComplete ? 'The core loop is unlocked. Careers now feed your money, vehicles and future objectives.' : 'Pizza Courier teaches the complete loop: choose work, earn money, gain XP and move toward a better vehicle.'}</p>
                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between text-xs"><span className="font-bold text-white/38">Onboarding progress</span><span className="font-black text-[var(--accent)]">{onboardingCompletedCount}/3</span></div>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${(onboardingCompletedCount / 3) * 100}%` }} /></div>
                </div>
                <button type="button" onClick={() => onboardingComplete ? dismissOnboarding() : onNavigate(profileReady ? '/pizzer' : '/profile')} className="btn-secondary mt-6 w-full rounded-2xl px-4 py-3 text-sm">
                  {onboardingComplete ? 'Enter the full city' : profileReady ? 'Start first delivery' : 'Set city identity'}
                </button>
              </div>

              <div className="p-6 sm:p-7">
                <div className="space-y-3">
                  <OnboardingStep number="01" title="Create your identity" detail="Set the name used across the city." complete={profileReady} />
                  <OnboardingStep number="02" title="Open Pizza dispatch" detail="Start the Bicycle Courier shift." complete={courierStarted} />
                  <OnboardingStep number="03" title="Finish customer handoff" detail="Collect the first cash and XP reward." complete={firstDeliveryComplete} />
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="grid gap-5 xl:grid-cols-[0.86fr_1.14fr]">
          <section className="game-panel-soft p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker">{objective.kicker}</p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white">{objective.title}</h2>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[rgba(211,255,81,0.18)] bg-[rgba(211,255,81,0.065)] text-[var(--accent)]"><CityIcon name={objective.icon} className="h-6 w-6" /></span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/40">{objective.description}</p>
            <div className="mt-7">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs"><span className="font-bold text-white/36">Objective progress</span><span className="text-right font-black text-white">{objective.progressLabel}</span></div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${objective.progress}%` }} /></div>
            </div>
            <button type="button" onClick={() => onNavigate(objective.path)} className="btn-primary mt-6 w-full rounded-2xl px-4 py-3.5 text-sm">{objective.action}</button>
          </section>

          <section className="game-panel-soft p-5 sm:p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="section-kicker">City pulse</p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white">Recent activity</h2>
              </div>
              <button type="button" onClick={() => onNavigate('/profile')} className="btn-ghost rounded-xl px-3 py-2 text-[10px]">View profile</button>
            </div>

            {activities.length > 0 ? (
              <div className="mt-5 space-y-3">
                {activities.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3 rounded-[18px] border border-white/[0.065] bg-black/20 p-3.5">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border ${toneClasses(activity.tone)}`}><CityIcon name={activity.icon} className="h-[18px] w-[18px]" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-black text-white">{activity.title}</p>
                        <p className="shrink-0 text-[10px] font-bold text-white/24">{relativeTime(activity.createdAt)}</p>
                      </div>
                      <p className="mt-1 truncate text-xs text-white/35">{activity.detail}</p>
                    </div>
                    {(activity.amount || activity.xp) ? (
                      <div className="shrink-0 text-right">
                        {activity.amount ? <p className="text-xs font-black text-[var(--money)]">+{fmt(activity.amount)} $</p> : null}
                        {activity.xp ? <p className="text-[10px] font-black text-[var(--accent)]">+{activity.xp} XP</p> : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[20px] border border-dashed border-white/[0.1] bg-black/15 p-7 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.035] text-white/30"><CityIcon name="route" className="h-6 w-6" /></span>
                <p className="mt-4 text-sm font-black text-white">No city activity yet</p>
                <p className="mt-2 text-xs leading-relaxed text-white/34">Complete the first Pizza Courier run and the reward will appear here.</p>
              </div>
            )}
          </section>
        </div>

        <section className="game-panel-soft p-5 sm:p-6">
          <div>
            <p className="section-kicker">Career shortcuts</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white">Keep the city moving</h2>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <CareerCard icon="pizza" label="Pizza Courier" level={courierLevel} stat={`${deliveries} deliveries`} detail={pizzer?.shiftState === 'IDLE' ? 'Dispatch ready' : 'Shift active'} onClick={() => onNavigate('/pizzer')} />
            <CareerCard icon="plane" label="Pilot" level={pilotLevel} stat={`${pilot?.progress.totalFlights || 0} flights`} detail={`${fmt(pilot?.progress.totalEarnings || 0)} $ earned`} onClick={() => onNavigate('/pilot')} />
            <CareerCard icon="fish" label="Fisher" level={fisherLevel} stat={`${fisher?.progress.totalCatches || 0} catches`} detail={`${Number(fisher?.carryWeightKg || 0).toFixed(1)}kg carried`} onClick={() => onNavigate('/fisher')} />
          </div>
        </section>
      </div>
    </div>
  );
}

function HubStat({ icon, label, value, tone = 'default' }: { icon: CityIconName; label: string; value: string; tone?: 'default' | 'money' }) {
  return (
    <div className="rounded-[18px] border border-white/[0.07] bg-black/20 p-4">
      <div className="flex items-center gap-2 text-white/28"><CityIcon name={icon} className="h-4 w-4" /><p className="text-[9px] font-black uppercase tracking-[0.13em]">{label}</p></div>
      <p className={`mt-3 truncate text-sm font-black ${tone === 'money' ? 'text-[var(--money)]' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function OnboardingStep({ number, title, detail, complete }: { number: string; title: string; detail: string; complete: boolean }) {
  return (
    <div className={`flex items-center gap-4 rounded-[18px] border p-4 ${complete ? 'border-[rgba(114,227,154,0.17)] bg-[rgba(114,227,154,0.045)]' : 'border-white/[0.07] bg-black/18'}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-[10px] font-black ${complete ? 'bg-[var(--money)] text-[#0c1710]' : 'bg-white/[0.045] text-white/34'}`}>{complete ? <CityIcon name="check" className="h-5 w-5" /> : number}</span>
      <div className="min-w-0 flex-1"><p className="text-sm font-black text-white">{title}</p><p className="mt-1 text-xs text-white/35">{detail}</p></div>
      <p className={`text-[9px] font-black uppercase tracking-[0.13em] ${complete ? 'text-[var(--money)]' : 'text-white/25'}`}>{complete ? 'Done' : 'Pending'}</p>
    </div>
  );
}

function CareerCard({ icon, label, level, stat, detail, onClick }: { icon: CityIconName; label: string; level: number; stat: string; detail: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="game-card-interactive p-5 text-left">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035] text-[var(--accent)]"><CityIcon name={icon} className="h-5 w-5" /></span>
        <span className="rounded-full border border-white/[0.09] bg-black/25 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white/42">Level {level}</span>
      </div>
      <h3 className="mt-5 text-xl font-black text-white">{label}</h3>
      <p className="mt-2 text-sm font-black text-[var(--money)]">{stat}</p>
      <p className="mt-1 text-xs text-white/34">{detail}</p>
      <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4"><span className="text-[10px] font-black uppercase tracking-[0.13em] text-white/28">Open career</span><CityIcon name="route" className="h-4 w-4 text-[var(--accent)]" /></div>
    </button>
  );
}
