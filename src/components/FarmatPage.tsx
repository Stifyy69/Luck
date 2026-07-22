import { useEffect, useState } from 'react';
import PageDisclaimer from './PageDisclaimer';
import { usePlayer } from '../hooks/usePlayer';
import { api } from '../lib/api';
import { publishCityProgress } from '../lib/cityProgressApi';
import type { CityProgress, CityProgressReward } from '../lib/cityProgress';
import type { CayoActionResult, CayoState } from '../types/game';

type ActionKey = 'collect_leaves' | 'process_pack' | 'refine_pack';
type PopupType = 'success' | 'danger' | 'info';

const ACTION_ART: Record<ActionKey, string> = {
  collect_leaves: '/jobs/cayo/leaves.svg',
  process_pack: '/jobs/cayo/white-pack.svg',
  refine_pack: '/jobs/cayo/blue-pack.svg',
};

const actions: Record<ActionKey, { title: string; duration: number; risk: number; timeSpentHours: number; run: string; stage: string }> = {
  collect_leaves: {
    title: 'Collect Leaves',
    duration: 5,
    risk: 10,
    timeSpentHours: 0.5,
    run: '+1200 leaves',
    stage: 'Supply stage 01',
  },
  process_pack: {
    title: 'Process White Packs',
    duration: 5,
    risk: 10,
    timeSpentHours: 0.5,
    run: '1200 leaves + 900,000 dirty cash -> 400 white packs',
    stage: 'Supply stage 02',
  },
  refine_pack: {
    title: 'Process Blue Packs',
    duration: 5,
    risk: 10,
    timeSpentHours: 1,
    run: '400 white packs + 100,000 dirty cash -> 800 blue packs',
    stage: 'Supply stage 03',
  },
};

function fmt(value: number) {
  return value.toLocaleString('en-US');
}

export default function FarmatPage() {
  const { player, playerId, refresh } = usePlayer();
  const [serverState, setServerState] = useState<CayoState | null>(null);

  const [activeAction, setActiveAction] = useState<ActionKey | null>(null);
  const [timer, setTimer] = useState(0);
  const [popup, setPopup] = useState<null | { type: PopupType; text: string }>(null);
  const [confirmConvert, setConfirmConvert] = useState<null | { key: ActionKey; needed: number; cleanCost: number }>(null);
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.cayoState(playerId)
      .then((payload) => { if (!cancelled) setServerState(payload.state); })
      .catch((error) => { if (!cancelled) setPopup({ type: 'danger', text: error instanceof Error ? error.message : 'Cayo state failed.' }); });
    return () => { cancelled = true; };
  }, [playerId]);

  const frunze = serverState?.leaves ?? 0;
  const plicuriAlbe = serverState?.whitePacks ?? 0;
  const plicuriAlbastre = serverState?.bluePacks ?? 0;
  const baniMurdari = serverState?.dirtyMoney ?? 0;
  const baniCurati = serverState?.cleanMoney ?? player?.cleanMoney ?? 0;

  const pushPopup = (type: PopupType, text: string) => {
    setPopup({ type, text });
    window.setTimeout(() => setPopup(null), 3200);
  };

  const canRun = activeAction === null && !isConverting;

  const operationId = (prefix: string) => {
    const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    return `${prefix}_${suffix}`;
  };

  const applyResult = (result: CayoActionResult) => {
    setServerState(result.state);
    if (result.cityProgress) {
      publishCityProgress(result.cityProgress as CityProgress, (result.cityReward || null) as CityProgressReward | null);
    }
    refresh();
  };

  const startAction = async (key: ActionKey, useCleanForShortfall = false) => {
    const action = actions[key];
    setActiveAction(key);
    setTimer(action.duration);
    try {
      const stage = key === 'collect_leaves' ? 'COLLECT' : key === 'process_pack' ? 'PROCESS' : 'REFINE';
      const request = api.cayoAction(playerId, stage, operationId(`cayo_${stage.toLowerCase()}`), useCleanForShortfall);
      for (let remaining = action.duration - 1; remaining >= 0; remaining -= 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        setTimer(remaining);
      }
      const result = await request;
      applyResult(result);
      if (result.raided) pushPopup('danger', 'POLICE RAID! The server removed the current run supplies.');
      else if (key === 'collect_leaves') pushPopup('success', '+1200 leaves.');
      else if (key === 'process_pack') pushPopup('success', 'Conversion complete: 1200 leaves -> 400 white packs.');
      else pushPopup('success', 'Conversion complete: 400 white packs -> 800 blue packs.');
    } catch (error) {
      pushPopup('danger', error instanceof Error ? error.message : 'Cayo action failed.');
    } finally {
      setActiveAction(null);
      setTimer(0);
    }
  };

  const runAction = (key: ActionKey) => {
    if (!canRun) return;

    if (key === 'process_pack' && frunze < 1200) {
      pushPopup('danger', 'You need 1200 leaves.');
      return;
    }

    if (key === 'refine_pack' && plicuriAlbe < 400) {
      pushPopup('danger', 'You need 400 white packs.');
      return;
    }

    if (key === 'process_pack' && baniMurdari < 900_000) {
      const needed = 900_000 - baniMurdari;
      const cleanCost = Math.ceil(needed * 0.65);
      if (baniCurati < cleanCost) {
        pushPopup('danger', 'You do not have enough clean money for materials.');
        return;
      }
      setConfirmConvert({ key, needed, cleanCost });
      return;
    }

    if (key === 'refine_pack' && baniMurdari < 100_000) {
      const needed = 100_000 - baniMurdari;
      const cleanCost = Math.ceil(needed * 0.65);
      if (baniCurati < cleanCost) {
        pushPopup('danger', 'You do not have enough clean money for materials.');
        return;
      }
      setConfirmConvert({ key, needed, cleanCost });
      return;
    }

    void startAction(key);
  };

  const confirmConvertAndRun = async () => {
    if (!confirmConvert || isConverting) return;
    setIsConverting(true);
    try {
      const actionKey = confirmConvert.key;
      setConfirmConvert(null);
      await startAction(actionKey, true);
    } finally {
      setIsConverting(false);
    }
  };

  const convertDirtyToClean = async () => {
    if (activeAction) return;
    if (baniMurdari <= 0) return;
    try {
      const result = await api.cayoConvert(playerId, operationId('cayo_convert'));
      applyResult(result);
      pushPopup('success', `Conversion successful: +${fmt(Number(result.cleanGained || 0))} clean money.`);
    } catch {
      pushPopup('danger', 'Could not sync conversion with server.');
    }
  };

  const sellBulk = async () => {
    if (!plicuriAlbastre) {
      pushPopup('danger', 'You do not have goods for bulk sale.');
      return;
    }
    try {
      const result = await api.cayoSell(playerId, 'BULK', operationId('cayo_bulk'));
      applyResult(result);
      pushPopup('success', `Bulk sale: +${fmt(Number(result.payout || 0))} dirty cash.`);
    } catch (error) {
      pushPopup('danger', error instanceof Error ? error.message : 'Bulk sale failed.');
    }
  };

  const deliver100 = async () => {
    if (plicuriAlbastre < 100) {
      pushPopup('danger', 'You need at least 100 blue packs.');
      return;
    }

    try {
      const result = await api.cayoSell(playerId, 'DELIVERY_100', operationId('cayo_delivery'));
      applyResult(result);
      pushPopup(result.raided ? 'danger' : 'success', result.raided
        ? 'POLICE RAID! You lost 100 units.'
        : `Delivery successful: +${fmt(Number(result.payout || 0))} dirty cash.`);
    } catch (error) {
      pushPopup('danger', error instanceof Error ? error.message : 'Delivery failed.');
    }
  };

  return (
    <div className="min-h-screen px-4 pb-10 pt-20 sm:px-6 md:px-8 md:pb-12 md:pt-8">
      {popup && (
        <div className={`animate-toast-in fixed left-1/2 top-4 z-[140] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border px-4 py-3 text-sm font-bold shadow-2xl backdrop-blur-xl md:top-6 ${popup.type === 'success' ? 'border-[rgba(114,227,154,0.25)] bg-[#0d1d14]/95 text-[#c8f9d8]' : popup.type === 'danger' ? 'border-red-400/25 bg-[#261113]/95 text-red-100' : 'border-[rgba(114,183,255,0.25)] bg-[#0d1724]/95 text-[#cbe3ff]'}`}>
          {popup.text}
        </div>
      )}

      <div className="mx-auto max-w-[1220px] space-y-5">
        <section className="game-panel relative overflow-hidden px-5 py-10 text-center sm:px-8 sm:py-12">
          <div className="pointer-events-none absolute left-1/2 top-[-190px] h-[380px] w-[560px] -translate-x-1/2 rounded-full bg-[var(--accent)] opacity-[0.055] blur-3xl" />
          <div className="relative mx-auto max-w-3xl">
            <p className="section-kicker">Cayo supply chain</p>
            <h1 className="display-title mt-5">Build the full chain.</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/45">Collect the raw supply, process it through every stage and choose how to move the final product.</p>

            <div className="mt-7 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-6 sm:grid-cols-5">
              <HeroStat label="Leaves" value={fmt(frunze)} />
              <HeroStat label="White packs" value={fmt(plicuriAlbe)} />
              <HeroStat label="Blue packs" value={fmt(plicuriAlbastre)} />
              <HeroStat label="Dirty cash" value={`${fmt(baniMurdari)} $`} />
              <HeroStat label="Clean money" value={`${fmt(baniCurati)} $`} money />
            </div>
          </div>
        </section>

        <section className="game-panel-soft p-5 sm:p-6">
          <div>
            <p className="section-kicker">Production line</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">Three stages, one supply chain</h2>
            <p className="mt-2 text-sm text-white/38">1200 leaves become 400 white packs. 400 white packs become 800 blue packs.</p>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {(Object.keys(actions) as ActionKey[]).map((key) => {
              const action = actions[key];
              const canClickAction = key === 'collect_leaves' ? canRun : key === 'process_pack' ? canRun && frunze >= 1200 : canRun && plicuriAlbe >= 400;
              const hasFullMaterials = key === 'collect_leaves' ? canRun : key === 'process_pack' ? canRun && frunze >= 1200 && baniMurdari >= 900_000 : canRun && plicuriAlbe >= 400 && baniMurdari >= 100_000;
              const canConvertFromClean = key === 'process_pack'
                ? canRun && frunze >= 1200 && baniMurdari < 900_000 && baniCurati >= Math.ceil((900_000 - baniMurdari) * 0.65)
                : key === 'refine_pack'
                  ? canRun && plicuriAlbe >= 400 && baniMurdari < 100_000 && baniCurati >= Math.ceil((100_000 - baniMurdari) * 0.65)
                  : false;
              const isActive = activeAction === key;

              return (
                <article key={key} className={`overflow-hidden rounded-[22px] border p-4 ${isActive ? 'border-[rgba(211,255,81,0.36)] bg-[rgba(211,255,81,0.07)]' : hasFullMaterials ? 'border-[rgba(211,255,81,0.18)] bg-[rgba(211,255,81,0.035)]' : 'border-white/[0.08] bg-black/20'}`}>
                  <div className="relative flex h-[190px] items-center justify-center rounded-[18px] border border-white/[0.08] bg-[#090c09] p-3">
                    <img src={ACTION_ART[key]} alt={action.title} className={`h-full w-full object-contain ${canClickAction ? '' : 'grayscale opacity-45'}`} />
                    <span className="absolute right-3 top-3 rounded-full border border-white/[0.1] bg-black/60 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white/48">{action.stage}</span>
                  </div>

                  <div className="mt-4 flex items-start justify-between gap-3">
                    <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/26">Cayo process</p><h3 className="mt-1 text-xl font-black text-white">{action.title}</h3></div>
                    <p className="text-right text-sm font-black text-[var(--accent)]">{action.duration}s<span className="block text-xs text-white/35">{action.timeSpentHours}h city time</span></p>
                  </div>

                  <p className="mt-3 min-h-[42px] text-xs leading-relaxed text-white/42">{action.run}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 border-y border-white/[0.065] py-4"><ProcessStat label="Risk" value={`${action.risk}%`} /><ProcessStat label="Status" value={isActive ? 'Running' : hasFullMaterials ? 'Ready' : canConvertFromClean ? 'Convertible' : 'Missing supply'} /></div>

                  <button type="button" onClick={() => runAction(key)} disabled={!canClickAction} className={`mt-5 w-full rounded-2xl px-4 py-3 text-sm font-black disabled:cursor-not-allowed ${hasFullMaterials || key === 'collect_leaves' ? 'btn-secondary' : canConvertFromClean ? 'border border-[rgba(240,196,106,0.3)] bg-[rgba(240,196,106,0.08)] text-[var(--warning)]' : 'btn-ghost opacity-40'}`}>
                    {isActive ? `Processing ${timer}s` : canConvertFromClean ? 'Convert cash and run' : key === 'collect_leaves' ? 'Collect supply' : hasFullMaterials ? 'Start process' : 'Missing materials'}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        {activeAction && (
          <section className="game-panel-soft grid gap-5 p-5 sm:p-6 md:grid-cols-[0.75fr_1.25fr] md:items-center">
            <div className="flex h-[180px] items-center justify-center rounded-[20px] border border-white/[0.08] bg-[#090c09] p-3"><img src={ACTION_ART[activeAction]} alt={actions[activeAction].title} className="h-full w-full object-contain" /></div>
            <div><p className="section-kicker">Process active</p><h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">{actions[activeAction].title}</h2><p className="mt-2 text-sm text-white/38">The current stage resolves automatically when the timer reaches zero.</p><div className="mt-5"><div className="mb-2 flex items-center justify-between text-xs"><span className="font-bold text-white/40">Stage progress</span><span className="font-black text-[var(--accent)]">{timer}s</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, ((actions[activeAction].duration - timer) / actions[activeAction].duration) * 100))}%` }} /></div></div></div>
          </section>
        )}

        <section className="game-panel-soft p-5 sm:p-6">
          <div><p className="section-kicker">Exit routes</p><h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">Move the finished product</h2><p className="mt-2 text-sm text-white/38">Choose volume, higher per-unit payout or convert the full dirty balance into clean money.</p></div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <SaleCard title="Bulk Sale" subtitle="Move the full blue inventory" value="2,300 $ / unit" status={`${fmt(plicuriAlbastre)} units ready`} disabled={!plicuriAlbastre || Boolean(activeAction)} onClick={sellBulk} />
            <SaleCard title="100 Unit Delivery" subtitle="Higher payout with 10% raid risk" value="3,179 $ / unit" status={`${Math.floor(plicuriAlbastre / 100)} runs ready`} disabled={plicuriAlbastre < 100 || Boolean(activeAction)} onClick={deliver100} warning />
            <SaleCard title="Cash Conversion" subtitle="Convert the full dirty balance" value="65% clean return" status={`${fmt(baniMurdari)} $ available`} disabled={baniMurdari <= 0 || Boolean(activeAction)} onClick={() => { convertDirtyToClean().catch(() => {}); }} money />
          </div>
        </section>

        <PageDisclaimer />
      </div>

      {confirmConvert && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" onClick={() => !isConverting && setConfirmConvert(null)}>
          <div className="game-panel w-full max-w-md p-6" onClick={(event) => event.stopPropagation()}>
            <p className="section-kicker">Material conversion</p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">Use clean money for missing materials?</h3>
            <div className="mt-5 grid grid-cols-2 gap-3"><ModalStat label="Dirty required" value={`${fmt(confirmConvert.needed)} $`} /><ModalStat label="Clean cost" value={`${fmt(confirmConvert.cleanCost)} $`} money /></div>
            <p className="mt-4 text-xs leading-relaxed text-white/42">The clean cost is deducted from the server balance before the production stage starts.</p>
            <div className="mt-6 flex gap-3"><button className="btn-ghost flex-1 rounded-2xl px-4 py-3 text-sm disabled:opacity-40" onClick={() => setConfirmConvert(null)} type="button" disabled={isConverting}>Cancel</button><button className="btn-primary flex-1 rounded-2xl px-4 py-3 text-sm disabled:opacity-40" onClick={() => { confirmConvertAndRun().catch(() => {}); }} type="button" disabled={isConverting}>{isConverting ? 'Converting...' : 'Confirm'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function HeroStat({ label, value, money = false }: { label: string; value: string; money?: boolean }) {
  return <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/25">{label}</p><p className={`mt-1 truncate text-sm font-black ${money ? 'text-[var(--money)]' : 'text-white'}`}>{value}</p></div>;
}

function ProcessStat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 text-center"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/24">{label}</p><p className="mt-1 truncate text-xs font-black text-white">{value}</p></div>;
}

function SaleCard({ title, subtitle, value, status, disabled, onClick, warning = false, money = false }: { title: string; subtitle: string; value: string; status: string; disabled: boolean; onClick: () => void; warning?: boolean; money?: boolean }) {
  return (
    <article className="game-card p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/27">Sales route</p>
      <h3 className="mt-1 text-xl font-black text-white">{title}</h3>
      <p className="mt-2 min-h-[36px] text-xs leading-relaxed text-white/42">{subtitle}</p>
      <p className={`mt-4 text-lg font-black ${money ? 'text-[var(--money)]' : warning ? 'text-[var(--warning)]' : 'text-[var(--accent)]'}`}>{value}</p>
      <p className="mt-1 text-xs text-white/35">{status}</p>
      <button type="button" onClick={onClick} disabled={disabled} className="btn-secondary mt-5 w-full rounded-2xl px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-35">Run route</button>
    </article>
  );
}

function ModalStat({ label, value, money = false }: { label: string; value: string; money?: boolean }) {
  return <div className="rounded-[17px] border border-white/[0.07] bg-black/20 p-4"><p className="text-[9px] font-black uppercase tracking-[0.13em] text-white/25">{label}</p><p className={`mt-1 text-base font-black ${money ? 'text-[var(--money)]' : 'text-white'}`}>{value}</p></div>;
}
