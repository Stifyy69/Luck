import { useEffect, useMemo, useState } from 'react';

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

const actions: Record<ActionKey, { title: string; duration: number; risk: number; timeLostHours: number; run: string }> = {
  collect_leaves: {
    title: 'Culege Frunze',
    duration: 10,
    risk: 10,
    timeLostHours: 1,
    run: '+1000 frunze',
  },
  process_pack: {
    title: 'Procesare Plicuri Albe',
    duration: 10,
    risk: 10,
    timeLostHours: 1,
    run: '2400 frunze -> 800 plicuri albe (cost 2.000.000 murdari)',
  },
  refine_pack: {
    title: 'Procesare Albastru',
    duration: 15,
    risk: 10,
    timeLostHours: 2.5,
    run: '800 plicuri albe -> 1600 plicuri albastre (cost 250.000 murdari)',
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

  const [timeLost, setTimeLost] = useState(saved?.timeLostFarm ?? 0);
  const [processedFrunze, setProcessedFrunze] = useState(saved?.processedFrunze ?? 0);
  const [processedAlbe, setProcessedAlbe] = useState(saved?.processedWhite ?? 0);
  const [processedAlbastre, setProcessedAlbastre] = useState(saved?.processedBlue ?? 0);
  const [rouletteSpent, setRouletteSpent] = useState(saved?.rouletteSpent ?? 0);
  const [rouletteWon, setRouletteWon] = useState(saved?.rouletteWon ?? 0);

  const [popup, setPopup] = useState<null | { type: PopupType; text: string }>(null);

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
      timeLostFarm: timeLost,
      processedFrunze,
      processedWhite: processedAlbe,
      processedBlue: processedAlbastre,
      rouletteSpent,
      rouletteWon,
      cashBalance: baniCurati,
      fragments: saved?.fragments ?? 0,
      ogCoinsBalance: saved?.ogCoinsBalance ?? 0,
      bonusSpins: saved?.bonusSpins ?? 0,
    });
  }, [frunze, plicuriAlbe, plicuriAlbastre, baniMurdari, baniCurati, timeLost, processedFrunze, processedAlbe, processedAlbastre, rouletteSpent, rouletteWon, saved]);

  const pushPopup = (type: PopupType, text: string) => {
    setPopup({ type, text });
    window.setTimeout(() => setPopup(null), 3200);
  };

  const loseAllInventory = () => {
    setFrunze(0);
    setPlicuriAlbe(0);
    setPlicuriAlbastre(0);
  };

  const canRun = activeAction === null;

  const convertCleanToDirty = (neededDirty: number) => {
    const missingDirty = Math.max(0, neededDirty - baniMurdari);
    if (!missingDirty) return true;

    const cleanNeeded = Math.ceil(missingDirty * 0.65);
    if (baniCurati < cleanNeeded) return false;

    setBaniCurati((current) => current - cleanNeeded);
    setBaniMurdari((current) => current + missingDirty);
    return true;
  };

  const runAction = (key: ActionKey) => {
    if (!canRun) return;
    const action = actions[key];

    if (key === 'process_pack' && frunze < 2400) {
      pushPopup('danger', 'Ai nevoie de 2400 frunze.');
      return;
    }

    if (key === 'refine_pack' && plicuriAlbe < 800) {
      pushPopup('danger', 'Ai nevoie de 800 plicuri albe.');
      return;
    }

    if (key === 'process_pack' && !convertCleanToDirty(2_000_000)) {
      pushPopup('danger', 'Nu ai fonduri. Mergi la Sleep ca sa faci bani curati.');
      return;
    }

    if (key === 'refine_pack' && !convertCleanToDirty(250_000)) {
      pushPopup('danger', 'Nu ai fonduri. Mergi la Sleep ca sa faci bani curati.');
      return;
    }

    setActiveAction(key);
    setTimer(action.duration);

    let t = action.duration;
    const interval = window.setInterval(() => {
      t -= 1;
      setTimer(t);

      if (t <= 0) {
        window.clearInterval(interval);

        const caught = Math.random() < action.risk / 100;
        setTimeLost((current) => current + action.timeLostHours);

        if (caught) {
          loseAllInventory();
          pushPopup('danger', 'A VENIT RAZIIIAAAA!!!');
          setActiveAction(null);
          return;
        }

        if (key === 'collect_leaves') {
          setFrunze((current) => current + 1000);
          setProcessedFrunze((current) => current + 1000);
          pushPopup('success', '+1000 frunze.');
        }

        if (key === 'process_pack') {
          setFrunze((current) => current - 2400);
          setPlicuriAlbe((current) => current + 800);
          setBaniMurdari((current) => current - 2_000_000);
          setProcessedAlbe((current) => current + 800);
          pushPopup('success', 'Conversie facuta: 2400 frunze -> 800 plicuri albe.');
        }

        if (key === 'refine_pack') {
          setPlicuriAlbe((current) => current - 800);
          setPlicuriAlbastre((current) => current + 1600);
          setBaniMurdari((current) => current - 250_000);
          setProcessedAlbastre((current) => current + 1600);
          pushPopup('success', 'Conversie facuta: 800 plicuri albe -> 1600 plicuri albastre.');
        }

        setActiveAction(null);
      }
    }, 1000);
  };

  const sellBulk = () => {
    if (!plicuriAlbastre) {
      pushPopup('danger', 'Nu ai marfa pentru vanzare bulk.');
      return;
    }

    const payout = plicuriAlbastre * 2300;
    setBaniMurdari((current) => current + payout);
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
      pushPopup('danger', 'Ai fost prins la livrare. Ai pierdut 100 bucati.');
      return;
    }

    const payout = 100 * 3179;
    setPlicuriAlbastre((current) => current - 100);
    setBaniMurdari((current) => current + payout);
    pushPopup('success', `Livrare reusita: +${payout.toLocaleString('ro-RO')} bani murdari.`);
  };

  const washMoney = () => {
    if (!baniMurdari) {
      pushPopup('danger', 'Nu ai bani murdari de convertit.');
      return;
    }

    const clean = Math.floor(baniMurdari * 0.65);
    setBaniMurdari(0);
    setBaniCurati((current) => current + clean);
    pushPopup('success', `Ai convertit ${clean.toLocaleString('ro-RO')} bani curati.`);
  };

  const stats = useMemo(
    () => [
      { label: 'Timp pierdut in joc', value: `${timeLost.toLocaleString('ro-RO')}h` },
      { label: 'Procesat frunze', value: processedFrunze.toLocaleString('ro-RO') },
      { label: 'Procesat albe', value: processedAlbe.toLocaleString('ro-RO') },
      { label: 'Procesat albastre', value: processedAlbastre.toLocaleString('ro-RO') },
      { label: 'Cheltuit ruleta', value: `${rouletteSpent.toLocaleString('ro-RO')} $` },
      { label: 'Castig ruleta', value: `${rouletteWon.toLocaleString('ro-RO')} $` },
      { label: 'Total ruleta', value: `${(rouletteWon - rouletteSpent).toLocaleString('ro-RO')} $` },
    ],
    [timeLost, processedFrunze, processedAlbe, processedAlbastre, rouletteSpent, rouletteWon],
  );

  return (
    <div className="min-h-screen bg-[#110d28] px-4 pb-10 pt-20 text-white sm:px-6">
      <div className="mx-auto grid max-w-[1340px] grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-2xl border border-white/15 bg-[#171438]/72 p-4 shadow-[0_25px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-6">
          <h1 className="text-center text-4xl font-black uppercase tracking-tight text-white">Farmat</h1>

          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-5">
            <StatCard label="Frunze" value={frunze} />
            <StatCard label="Plicuri Albe" value={plicuriAlbe} />
            <StatCard label="Plicuri Albastre" value={plicuriAlbastre} />
            <StatCard label="Bani Murdari" value={baniMurdari} money />
            <StatCard label="Bani Curati" value={baniCurati} money />
          </div>

          <div className="mt-4 rounded-xl border border-white/15 bg-black/25 p-3">
            <p className="text-sm font-semibold text-white/75">2400 Frunze -&gt; 800 Plicuri Albe -&gt; 1600 Plicuri Albastre</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(Object.keys(actions) as ActionKey[]).map((key, index) => {
              const action = actions[key];
          const color = index === 0 ? 'from-emerald-500/25 to-emerald-700/10' : index === 1 ? 'from-sky-500/25 to-blue-700/10' : 'from-fuchsia-500/25 to-purple-700/10';
          const canRunAction =
            key === 'collect_leaves'
              ? canRun
              : key === 'process_pack'
                ? canRun && frunze >= 2400 && (baniMurdari >= 2_000_000 || baniCurati >= Math.ceil((2_000_000 - baniMurdari) * 0.65))
                : canRun && plicuriAlbe >= 800 && (baniMurdari >= 250_000 || baniCurati >= Math.ceil((250_000 - baniMurdari) * 0.65));
          return (
            <button
              key={key}
              type="button"
              onClick={() => runAction(key)}
              disabled={!canRunAction}
              className={`rounded-xl border border-white/15 p-4 text-left transition ${canRunAction ? `bg-gradient-to-br ${color} hover:brightness-110` : 'bg-[#1d1a34] text-white/50'}`}
            >
                  <p className="text-base font-black">{action.title}</p>
                  <p className="mt-1 text-sm">Durata: {action.duration}s</p>
                  <p className="text-sm">{action.run}</p>
                  <p className="text-sm">Timp joc: {action.timeLostHours}h · Risc: {action.risk}%</p>
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
              <button type="button" onClick={washMoney} className={`rounded-lg px-4 py-2 text-sm font-bold ${baniMurdari ? 'bg-amber-500/90 text-black' : 'bg-[#2a2744] text-white/50'}`}>
                Converteste bani curati (65%)
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

        <aside className="rounded-2xl border border-white/15 bg-[#13112d]/72 p-4 backdrop-blur-xl">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Stats</p>
          <div className="mt-3 space-y-2">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-white/10 bg-black/25 p-2.5">
                <p className="text-xs text-white/55">{s.label}</p>
                <p className="text-base font-black text-white">{s.value}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {popup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div
            className={`w-full max-w-md rounded-2xl border px-5 py-5 text-center text-base font-semibold shadow-xl ${popup.type === 'success' ? 'border-emerald-300/40 bg-emerald-500/20 text-emerald-100' : popup.type === 'danger' ? 'border-rose-300/40 bg-rose-500/20 text-rose-100' : 'border-sky-300/40 bg-sky-500/20 text-sky-100'}`}
          >
            {popup.text}
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
