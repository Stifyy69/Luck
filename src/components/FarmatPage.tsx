import { useMemo, useState } from 'react';

type ActionKey = 'collect_leaves' | 'process_pack' | 'refine_pack';

type ToastType = 'success' | 'danger' | 'info';

const actions: Record<ActionKey, { title: string; duration: number; risk: number; timeLostHours: number; run: string }> = {
  collect_leaves: {
    title: 'Culege frunze',
    duration: 10,
    risk: 10,
    timeLostHours: 1,
    run: '+1000 frunze',
  },
  process_pack: {
    title: 'Procesare plicuri nivel 1',
    duration: 10,
    risk: 10,
    timeLostHours: 1,
    run: '2400 frunze -> 800 plicuri (cost 2.000.000 murdari)',
  },
  refine_pack: {
    title: 'Procesare plicuri nivel 2',
    duration: 15,
    risk: 10,
    timeLostHours: 2.5,
    run: '800 plicuri -> 1600 plicuri finale (cost 250.000 murdari)',
  },
};

export default function FarmatPage() {
  const [frunze, setFrunze] = useState(0);
  const [plicuriNivel1, setPlicuriNivel1] = useState(0);
  const [plicuriFinale, setPlicuriFinale] = useState(0);
  const [baniMurdari, setBaniMurdari] = useState(5_000_000);
  const [baniCurati, setBaniCurati] = useState(0);

  const [activeAction, setActiveAction] = useState<ActionKey | null>(null);
  const [timer, setTimer] = useState(0);
  const [timeLost, setTimeLost] = useState(0);

  const [processedFrunze, setProcessedFrunze] = useState(0);
  const [processedNivel1, setProcessedNivel1] = useState(0);
  const [processedFinale, setProcessedFinale] = useState(0);
  const [rouletteSpent, setRouletteSpent] = useState(0);
  const [rouletteWon, setRouletteWon] = useState(0);

  const [toasts, setToasts] = useState<Array<{ id: number; type: ToastType; text: string }>>([]);

  const pushToast = (type: ToastType, text: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, type, text }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 3500);
  };

  const loseAllInventory = () => {
    setFrunze(0);
    setPlicuriNivel1(0);
    setPlicuriFinale(0);
  };

  const canRun = activeAction === null;

  const runAction = (key: ActionKey) => {
    if (!canRun) return;
    const action = actions[key];

    if (key === 'process_pack' && (frunze < 2400 || baniMurdari < 2_000_000)) {
      pushToast('danger', 'Ai nevoie de 2400 frunze si 2.000.000 bani murdari.');
      return;
    }

    if (key === 'refine_pack' && (plicuriNivel1 < 800 || baniMurdari < 250_000)) {
      pushToast('danger', 'Ai nevoie de 800 plicuri nivel 1 si 250.000 bani murdari.');
      return;
    }

    setActiveAction(key);
    setTimer(action.duration);
    pushToast('info', `${action.title} a pornit.`);

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
          pushToast('danger', 'Ai fost prins in control. Inventarul curent a fost pierdut.');
          setActiveAction(null);
          return;
        }

        if (key === 'collect_leaves') {
          setFrunze((current) => current + 1000);
          setProcessedFrunze((current) => current + 1000);
          pushToast('success', '+1000 frunze.');
        }

        if (key === 'process_pack') {
          setFrunze((current) => current - 2400);
          setPlicuriNivel1((current) => current + 800);
          setBaniMurdari((current) => current - 2_000_000);
          setProcessedNivel1((current) => current + 800);
          pushToast('success', 'Conversie reusita: 2400 frunze -> 800 plicuri nivel 1.');
        }

        if (key === 'refine_pack') {
          setPlicuriNivel1((current) => current - 800);
          setPlicuriFinale((current) => current + 1600);
          setBaniMurdari((current) => current - 250_000);
          setProcessedFinale((current) => current + 1600);
          pushToast('success', 'Conversie reusita: 800 plicuri nivel 1 -> 1600 plicuri finale.');
        }

        setActiveAction(null);
      }
    }, 1000);
  };

  const sellBulk = () => {
    if (!plicuriFinale) {
      pushToast('danger', 'Nu ai plicuri finale pentru vanzare.');
      return;
    }

    const payout = plicuriFinale * 2300;
    setBaniMurdari((current) => current + payout);
    setPlicuriFinale(0);
    pushToast('success', `Vanzare bulk: +${payout.toLocaleString('ro-RO')} bani murdari.`);
  };

  const deliver100 = () => {
    if (plicuriFinale < 100) {
      pushToast('danger', 'Ai nevoie de minim 100 plicuri finale pentru livrare.');
      return;
    }

    const caught = Math.random() < 0.1;
    if (caught) {
      setPlicuriFinale((current) => current - 100);
      pushToast('danger', 'Ai fost prins la livrare. Ai pierdut 100 plicuri finale.');
      return;
    }

    const payout = 100 * 3179;
    setPlicuriFinale((current) => current - 100);
    setBaniMurdari((current) => current + payout);
    pushToast('success', `Livrare reusita: +${payout.toLocaleString('ro-RO')} bani murdari.`);
  };

  const washMoney = () => {
    if (!baniMurdari) {
      pushToast('danger', 'Nu ai bani murdari pentru conversie.');
      return;
    }

    const clean = Math.floor(baniMurdari * 0.65);
    setBaniMurdari(0);
    setBaniCurati((current) => current + clean);
    pushToast('success', `Conversie reusita: ${clean.toLocaleString('ro-RO')} bani curati.`);
  };

  const stats = useMemo(
    () => [
      { label: 'Timp pierdut in joc', value: `${timeLost.toLocaleString('ro-RO')}h` },
      { label: 'Frunze adunate', value: processedFrunze.toLocaleString('ro-RO') },
      { label: 'Plicuri nivel 1', value: processedNivel1.toLocaleString('ro-RO') },
      { label: 'Plicuri finale', value: processedFinale.toLocaleString('ro-RO') },
      { label: 'Cheltuit ruleta', value: `${rouletteSpent.toLocaleString('ro-RO')} $` },
      { label: 'Castig ruleta', value: `${rouletteWon.toLocaleString('ro-RO')} $` },
      { label: 'Total ruleta', value: `${(rouletteWon - rouletteSpent).toLocaleString('ro-RO')} $` },
    ],
    [processedFinale, processedFrunze, processedNivel1, rouletteSpent, rouletteWon, timeLost],
  );

  return (
    <div className="min-h-screen bg-[#110d28] px-4 pb-10 pt-20 text-white sm:px-6">
      <div className="mx-auto grid max-w-[1340px] grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-2xl border border-white/15 bg-[#171438]/72 p-4 shadow-[0_25px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-6">
          <h1 className="text-center text-4xl font-black uppercase tracking-tight text-white">Farmat</h1>

          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-5">
            <StatCard label="Frunze" value={frunze} />
            <StatCard label="Plicuri nivel 1" value={plicuriNivel1} />
            <StatCard label="Plicuri finale" value={plicuriFinale} />
            <StatCard label="Bani murdari" value={baniMurdari} money />
            <StatCard label="Bani curati" value={baniCurati} money />
          </div>

          <div className="mt-4 rounded-xl border border-white/15 bg-black/25 p-3">
            <p className="text-sm font-semibold text-white/75">Ordine conversie: 2400 Frunze -&gt; 800 Plicuri nivel 1 -&gt; 1600 Plicuri finale</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(Object.keys(actions) as ActionKey[]).map((key, index) => {
              const action = actions[key];
              const color = index === 0 ? 'from-emerald-500/25 to-emerald-700/10' : index === 1 ? 'from-sky-500/25 to-blue-700/10' : 'from-fuchsia-500/25 to-purple-700/10';
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => runAction(key)}
                  disabled={!canRun}
                  className={`rounded-xl border border-white/15 bg-gradient-to-br ${color} p-4 text-left transition hover:brightness-110 disabled:opacity-50`}
                >
                  <p className="text-base font-black">{action.title}</p>
                  <p className="mt-1 text-sm text-white/70">Durata: {action.duration}s</p>
                  <p className="text-sm text-white/70">{action.run}</p>
                  <p className="text-sm text-white/70">Timp joc: {action.timeLostHours}h · Risc: {action.risk}%</p>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-xl border border-white/15 bg-black/25 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white/60">Vanzare</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={sellBulk} className="rounded-lg bg-emerald-500/80 px-4 py-2 text-sm font-bold">
                Vanzare bulk tot (2300/buc)
              </button>
              <button type="button" onClick={deliver100} className="rounded-lg bg-sky-500/80 px-4 py-2 text-sm font-bold">
                Livrare 100 buc (3179/buc)
              </button>
              <button type="button" onClick={washMoney} className="rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-bold text-black">
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

      <div className="fixed right-4 top-20 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`min-w-[260px] rounded-lg border px-3 py-2 text-sm font-semibold shadow-xl ${toast.type === 'success' ? 'border-emerald-300/40 bg-emerald-500/20 text-emerald-100' : toast.type === 'danger' ? 'border-rose-300/40 bg-rose-500/20 text-rose-100' : 'border-sky-300/40 bg-sky-500/20 text-sky-100'}`}
          >
            {toast.text}
          </div>
        ))}
      </div>
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
