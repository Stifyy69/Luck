import { useEffect, useState } from 'react';
import SharedStatsPanel from './SharedStatsPanel';
import PageDisclaimer from './PageDisclaimer';

type ActionKey = 'collect_leaves' | 'process_pack' | 'refine_pack';
type PopupType = 'success' | 'danger' | 'info';

const GAME_KEY = 'luck_game_state_v1';
const GAME_SALT = 'stifyy-ogromania-salt';

function signPayload(payload: unknown) {
  const raw = JSON.stringify(payload) + GAME_SALT;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  return String(hash);
}

function loadGameState() {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || !parsed?.sig) return null;
    return signPayload(parsed.data) === parsed.sig ? parsed.data : null;
  } catch {
    return null;
  }
}

function saveGameState(data: unknown) {
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify({ data, sig: signPayload(data) }));
  } catch {}
}

const actions: Record<ActionKey, { title: string; duration: number; risk: number; timeSpentHours: number; run: string }> = {
  collect_leaves: {
    title: 'Culege Frunze',
    duration: 5,
    risk: 10,
    timeSpentHours: 0.5,
    run: '+1200 frunze',
  },
  process_pack: {
    title: 'Procesare Plicuri Albe',
    duration: 5,
    risk: 10,
    timeSpentHours: 0.5,
    run: '1200 frunze + 900.000 murdari -> 400 plicuri albe',
  },
  refine_pack: {
    title: 'Procesare Albastru',
    duration: 5,
    risk: 10,
    timeSpentHours: 1,
    run: '400 plicuri albe + 100.000 murdari -> 800 plicuri albastre',
  },
};

export default function FarmatPage() {
  const saved = typeof window !== 'undefined' ? loadGameState() : null;

  const [frunze, setFrunze] = useState(saved?.frunze ?? 0);
  const [plicuriAlbe, setPlicuriAlbe] = useState(saved?.plicuriAlbe ?? 0);
  const [plicuriAlbastre, setPlicuriAlbastre] = useState(saved?.plicuriAlbastre ?? 0);
  const [baniMurdari, setBaniMurdari] = useState(saved?.baniMurdari ?? 0);
  const [baniCurati, setBaniCurati] = useState(saved?.cashBalance ?? saved?.baniCurati ?? 1_000_000);

  const [activeAction, setActiveAction] = useState<ActionKey | null>(null);
  const [timer, setTimer] = useState(0);

  const [timeFarm, setTimeFarm] = useState(saved?.timeFarm ?? saved?.timeLostFarm ?? 0);
  const [timeSleep, setTimeSleep] = useState(saved?.timeSleep ?? 0);
  const [processedFrunze, setProcessedFrunze] = useState(saved?.processedFrunze ?? 0);
  const [processedAlbe, setProcessedAlbe] = useState(saved?.processedWhite ?? 0);
  const [processedAlbastre, setProcessedAlbastre] = useState(saved?.processedBlue ?? 0);
  const [farmEarned, setFarmEarned] = useState(saved?.farmEarned ?? 0);
  const [rouletteSpent, setRouletteSpent] = useState(saved?.rouletteSpent ?? 0);
  const [rouletteWon, setRouletteWon] = useState(saved?.rouletteWon ?? 0);

  const [popup, setPopup] = useState<null | { type: PopupType; text: string }>(null);
  const [confirmConvert, setConfirmConvert] = useState<null | { key: ActionKey; needed: number; cleanCost: number }>(null);
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    const latest = loadGameState();
    if (!latest) return;
    setRouletteSpent(latest.rouletteSpent ?? 0);
    setRouletteWon(latest.rouletteWon ?? 0);
  }, []);

  useEffect(() => {
    const existing = loadGameState() || {};
    saveGameState({
      ...existing,
      frunze,
      plicuriAlbe,
      plicuriAlbastre,
      baniMurdari,
      baniCurati,
      timeFarm,
      timeSleep,
      processedFrunze,
      processedWhite: processedAlbe,
      processedBlue: processedAlbastre,
      farmEarned,
      rouletteSpent,
      rouletteWon,
      cashBalance: baniCurati,
      fragments: saved?.fragments ?? 0,
      ogCoinsBalance: saved?.ogCoinsBalance ?? 0,
      bonusSpins: saved?.bonusSpins ?? 0,
    });
  }, [frunze, plicuriAlbe, plicuriAlbastre, baniMurdari, baniCurati, timeFarm, timeSleep, processedFrunze, processedAlbe, processedAlbastre, farmEarned, rouletteSpent, rouletteWon, saved]);

  const pushPopup = (type: PopupType, text: string) => {
    setPopup({ type, text });
    window.setTimeout(() => setPopup(null), 3200);
  };

  const canRun = activeAction === null;

  const startAction = (key: ActionKey, options?: { convertedDirtyCost?: number }) => {
    const action = actions[key];
    const convertedDirtyCost = options?.convertedDirtyCost ?? 0;
    const dirtyCost = key === 'process_pack' ? 900_000 : key === 'refine_pack' ? 100_000 : 0;
    const dirtyDebit = Math.max(0, dirtyCost - convertedDirtyCost);

    setActiveAction(key);
    setTimer(action.duration);

    let t = action.duration;
    const interval = window.setInterval(() => {
      t -= 1;
      setTimer(t);

      if (t <= 0) {
        window.clearInterval(interval);

        const caught = Math.random() < action.risk / 100;
        setTimeFarm((current) => current + action.timeSpentHours);

        if (caught) {
          if (key === 'process_pack') {
            setFrunze((current) => Math.max(0, current - 1200));
            if (dirtyDebit > 0) {
              setBaniMurdari((current) => Math.max(0, current - dirtyDebit));
            }
          }
          if (key === 'refine_pack') {
            setPlicuriAlbe((current) => Math.max(0, current - 400));
            if (dirtyDebit > 0) {
              setBaniMurdari((current) => Math.max(0, current - dirtyDebit));
            }
          }
          pushPopup('danger', 'A VENIT RAZIIIAAAA!!!');
          setActiveAction(null);
          return;
        }

        if (key === 'collect_leaves') {
          setFrunze((current) => current + 1200);
          setProcessedFrunze((current) => current + 1200);
          pushPopup('success', '+1200 frunze.');
        }

        if (key === 'process_pack') {
          setFrunze((current) => current - 1200);
          setPlicuriAlbe((current) => current + 400);
          if (dirtyDebit > 0) {
            setBaniMurdari((current) => current - dirtyDebit);
          }
          setProcessedAlbe((current) => current + 400);
          pushPopup('success', 'Conversie facuta: 1200 frunze -> 400 plicuri albe.');
        }

        if (key === 'refine_pack') {
          setPlicuriAlbe((current) => current - 400);
          setPlicuriAlbastre((current) => current + 800);
          if (dirtyDebit > 0) {
            setBaniMurdari((current) => current - dirtyDebit);
          }
          setProcessedAlbastre((current) => current + 800);
          pushPopup('success', 'Conversie facuta: 400 plicuri albe -> 800 plicuri albastre.');
        }

        setActiveAction(null);
      }
    }, 1000);
  };

  const runAction = (key: ActionKey) => {
    if (!canRun) return;

    if (key === 'process_pack' && frunze < 1200) {
      pushPopup('danger', 'Ai nevoie de 1200 frunze.');
      return;
    }

    if (key === 'refine_pack' && plicuriAlbe < 400) {
      pushPopup('danger', 'Ai nevoie de 400 plicuri albe.');
      return;
    }

    if (key === 'process_pack' && baniMurdari < 900_000) {
      const needed = 900_000 - baniMurdari;
      const cleanCost = Math.ceil(needed * 0.65);
      if (baniCurati < cleanCost) {
        pushPopup('danger', 'Nu ai bani curați suficienți pentru materiale.');
        return;
      }
      setConfirmConvert({ key, needed, cleanCost });
      return;
    }

    if (key === 'refine_pack' && baniMurdari < 100_000) {
      const needed = 100_000 - baniMurdari;
      const cleanCost = Math.ceil(needed * 0.65);
      if (baniCurati < cleanCost) {
        pushPopup('danger', 'Nu ai bani curați suficienți pentru materiale.');
        return;
      }
      setConfirmConvert({ key, needed, cleanCost });
      return;
    }

    startAction(key);
  };

  const confirmConvertAndRun = () => {
    if (!confirmConvert || isConverting) return;
    setIsConverting(true);
    setBaniCurati((current) => current - confirmConvert.cleanCost);
    const actionKey = confirmConvert.key;
    const convertedDirtyCost = confirmConvert.needed;
    setConfirmConvert(null);
    window.setTimeout(() => {
      startAction(actionKey, { convertedDirtyCost });
      setIsConverting(false);
    }, 0);
  };

  const convertDirtyToClean = () => {
    if (activeAction) return;
    if (baniMurdari <= 0) return;
    const gainClean = Math.floor(baniMurdari * 0.65);
    setBaniMurdari(0);
    setBaniCurati((current) => current + gainClean);
    pushPopup('success', `Convert reusit: +${gainClean.toLocaleString('ro-RO')} bani curati.`);
  };

  const sellBulk = () => {
    if (!plicuriAlbastre) {
      pushPopup('danger', 'Nu ai marfa pentru vanzare bulk.');
      return;
    }

    const payout = plicuriAlbastre * 2300;
    setBaniMurdari((current) => current + payout);
    setFarmEarned((current) => current + payout);
    setPlicuriAlbastre(0);
    pushPopup('success', `Vanzare bulk: +${payout.toLocaleString('ro-RO')} bani murdari.`);
  };

  const deliver100 = () => {
    if (plicuriAlbastre < 100) {
      pushPopup('danger', 'Ai nevoie de minim 100 plicuri albastre.');
      return;
    }

    const caught = Math.random() < 0.1;
    if (caught) {
      setPlicuriAlbastre((current) => current - 100);
      pushPopup('danger', 'A VENIT RAZIIIAAAA!!! Ai pierdut 100 bucati.');
      return;
    }

    const payout = 100 * 3179;
    setPlicuriAlbastre((current) => current - 100);
    setBaniMurdari((current) => current + payout);
    setFarmEarned((current) => current + payout);
    setTimeFarm((current) => current + 0.25);
    pushPopup('success', `Livrare reusita: +${payout.toLocaleString('ro-RO')} bani murdari.`);
  };

  return (
    <div className="min-h-screen bg-[#110d28] px-4 pb-10 pt-20 text-white sm:px-6">
      <div className="mx-auto grid max-w-[1460px] grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="hud-panel p-4 backdrop-blur-xl sm:p-6">
          <h1 className="text-center text-4xl font-black uppercase tracking-tight text-white">Cayo</h1>

          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-5">
            <StatCard label="Frunze" value={frunze} />
            <StatCard label="Plicuri Albe" value={plicuriAlbe} />
            <StatCard label="Plicuri Albastre" value={plicuriAlbastre} />
            <StatCard label="Bani Murdari" value={baniMurdari} money />
            <StatCard label="Bani Curati" value={baniCurati} money />
          </div>

          <div className="mt-4 rounded-xl border border-white/15 bg-black/25 p-3">
            <p className="text-sm font-semibold text-white/75">1200 Frunze -&gt; 400 Plicuri Albe -&gt; 800 Plicuri Albastre</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(Object.keys(actions) as ActionKey[]).map((key, index) => {
              const action = actions[key];
              const color = index === 0 ? 'from-emerald-500/25 to-emerald-700/10' : index === 1 ? 'from-sky-500/25 to-blue-700/10' : 'from-fuchsia-500/25 to-purple-700/10';
              const canClickAction =
                key === 'collect_leaves'
                  ? canRun
                  : key === 'process_pack'
                    ? canRun && frunze >= 1200
                    : canRun && plicuriAlbe >= 400;
              const isStyledActive =
                key === 'collect_leaves'
                  ? canRun
                  : key === 'process_pack'
                    ? canRun && frunze >= 1200 && baniMurdari >= 900_000
                    : canRun && plicuriAlbe >= 400 && baniMurdari >= 100_000;
              const canConvertFromClean =
                key === 'process_pack'
                  ? canRun && frunze >= 1200 && baniMurdari < 900_000 && baniCurati >= Math.ceil((900_000 - baniMurdari) * 0.65)
                  : key === 'refine_pack'
                    ? canRun && plicuriAlbe >= 400 && baniMurdari < 100_000 && baniCurati >= Math.ceil((100_000 - baniMurdari) * 0.65)
                    : false;
              const buttonClasses =
                key !== 'collect_leaves' && canConvertFromClean
                  ? 'bg-gradient-to-br from-amber-300/35 to-yellow-600/20 border-amber-200/60 text-yellow-100 shadow-[0_0_18px_rgba(250,204,21,0.25)] hover:brightness-110'
                  : isStyledActive
                    ? `bg-gradient-to-br ${color} hover:brightness-110`
                    : 'bg-[#1d1a34] text-white/50';
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => runAction(key)}
                  disabled={!canClickAction}
                  className={`rounded-xl border border-white/15 p-4 text-left transition ${buttonClasses}`}
                >
                  <p className="text-base font-black">{action.title}</p>
                  <p className="mt-1 text-sm">Durata: {action.duration}s</p>
                  <p className="text-sm">{action.run}</p>
                  <p className="text-sm">Timp joc: {action.timeSpentHours}h</p>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-xl border border-white/15 bg-black/25 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white/60">Vanzare</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={sellBulk} className={`rounded-lg px-4 py-2 text-sm font-bold ${plicuriAlbastre ? 'bg-emerald-500/80' : 'bg-[#2a2744] text-white/50'}`}>
                Vanzare bulk tot (2300/buc)
              </button>
              <button type="button" onClick={deliver100} className={`rounded-lg px-4 py-2 text-sm font-bold ${plicuriAlbastre >= 100 ? 'bg-sky-500/80' : 'bg-[#2a2744] text-white/50'}`}>
                Livrare 100 buc (3179/buc)
              </button>
              <button
                type="button"
                onClick={convertDirtyToClean}
                disabled={baniMurdari <= 0 || Boolean(activeAction)}
                className={`rounded-lg px-4 py-2 text-sm font-bold ${baniMurdari > 0 && !activeAction ? 'bg-amber-500/80 text-white' : 'bg-[#2a2744] text-white/50'}`}
              >
                Convert murdari în curati
              </button>
            </div>
          </div>

          {activeAction ? (
            <div className="mt-4 rounded-xl border border-violet-300/30 bg-violet-500/15 p-4 text-center">
              <p className="text-sm text-white/75">Actiune in curs...</p>
              <p className="mt-1 text-2xl font-black text-violet-200">{timer}s</p>
            </div>
          ) : null}
        </div>

        <SharedStatsPanel />
      </div>
      <div className="mx-auto mt-5 max-w-[1460px]"><PageDisclaimer /></div>

      {popup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={() => setPopup(null)}>
          <div
            onClick={(event) => event.stopPropagation()}
            className={`w-full max-w-md rounded-2xl border px-5 py-5 text-center text-base font-semibold shadow-xl ${popup.type === 'success' ? 'border-emerald-300/40 bg-emerald-500/20 text-emerald-100' : popup.type === 'danger' ? 'border-rose-300/40 bg-rose-500/20 text-rose-100' : 'border-sky-300/40 bg-sky-500/20 text-sky-100'}`}
          >
            {popup.text}
          </div>
        </div>
      ) : null}

      {confirmConvert ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !isConverting && setConfirmConvert(null)}>
          <div className="w-full max-w-md rounded-2xl border border-amber-300/40 bg-[#1a142d] p-5 text-white" onClick={(event) => event.stopPropagation()}>
            <p className="text-lg font-black">Convert la banii curați în murdari pentru materiale?</p>
            <p className="mt-2 text-sm text-white/70">
              Necesari murdari: {confirmConvert.needed.toLocaleString('ro-RO')} · Cost curat: {confirmConvert.cleanCost.toLocaleString('ro-RO')}
            </p>
            <div className="mt-4 flex gap-2">
              <button className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 font-bold disabled:opacity-60" onClick={confirmConvertAndRun} type="button" disabled={isConverting}>Da</button>
              <button className="flex-1 rounded-lg bg-white/10 px-4 py-2 font-bold disabled:opacity-60" onClick={() => setConfirmConvert(null)} type="button" disabled={isConverting}>Nu</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, money = false }: { label: string; value: number; money?: boolean }) {
  return (
    <div className="rounded-xl border border-white/15 bg-black/25 p-3 text-center">
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">{label}</p>
      <p className="mt-1 text-xl font-black text-white">
        {value.toLocaleString('ro-RO')}
        {money ? ' $' : ''}
      </p>
    </div>
  );
}
