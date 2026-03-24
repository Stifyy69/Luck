import { useMemo, useState } from 'react';

type ActionKey = 'collect' | 'process' | 'refine';

const actions: Record<ActionKey, { title: string; duration: number; reward: number; timeLost: string; risk: number; unit: string }> = {
  collect: {
    title: 'Culege resurse',
    duration: 10,
    reward: 1000,
    timeLost: '1h',
    risk: 10,
    unit: 'resurse',
  },
  process: {
    title: 'Procesare materiale',
    duration: 10,
    reward: 800,
    timeLost: '1h',
    risk: 10,
    unit: 'pachete',
  },
  refine: {
    title: 'Rafinare avansata',
    duration: 15,
    reward: 1600,
    timeLost: '2.5h',
    risk: 10,
    unit: 'unitati',
  },
};

export default function FarmatPage() {
  const [inventory, setInventory] = useState(0);
  const [dirtyMoney, setDirtyMoney] = useState(0);
  const [cleanMoney, setCleanMoney] = useState(0);
  const [activeAction, setActiveAction] = useState<ActionKey | null>(null);
  const [timer, setTimer] = useState(0);
  const [message, setMessage] = useState('Porneste o activitate de farmat.');

  const canRun = activeAction === null;

  const runAction = (key: ActionKey) => {
    if (!canRun) return;
    const action = actions[key];
    setActiveAction(key);
    setTimer(action.duration);
    setMessage(`${action.title} in curs...`);

    let t = action.duration;
    const interval = window.setInterval(() => {
      t -= 1;
      setTimer(t);
      if (t <= 0) {
        window.clearInterval(interval);

        const caught = Math.random() < action.risk / 100;
        if (caught) {
          setInventory(0);
          setMessage('Ai fost prins in control. Ai pierdut marfa curenta.');
        } else {
          setInventory((current) => current + action.reward);
          setMessage(`+${action.reward} ${action.unit} obtinute.`);
        }

        setActiveAction(null);
      }
    }, 1000);
  };

  const sellBulk = () => {
    if (!inventory) return;
    const payout = inventory * 2300;
    setDirtyMoney((money) => money + payout);
    setInventory(0);
    setMessage(`Ai vandut tot bulk pentru ${payout.toLocaleString('ro-RO')} bani murdari.`);
  };

  const delivery = () => {
    if (inventory < 100) return;
    const units = 100;
    const caught = Math.random() < 0.1;
    if (caught) {
      setInventory((current) => Math.max(0, current - units));
      setMessage('Ai fost prins la livrare. Ai pierdut 100 bucati.');
      return;
    }

    setInventory((current) => current - units);
    const payout = units * 3179;
    setDirtyMoney((money) => money + payout);
    setMessage(`Livrare reusita: +${payout.toLocaleString('ro-RO')} bani murdari.`);
  };

  const washMoney = () => {
    if (!dirtyMoney) return;
    const clean = Math.floor(dirtyMoney * 0.65);
    setCleanMoney((money) => money + clean);
    setDirtyMoney(0);
    setMessage(`Spalare reusita: +${clean.toLocaleString('ro-RO')} bani curati.`);
  };

  const totalStatus = useMemo(
    () => [
      { label: 'Marfa', value: inventory.toLocaleString('ro-RO') },
      { label: 'Bani murdari', value: dirtyMoney.toLocaleString('ro-RO') },
      { label: 'Bani curati', value: cleanMoney.toLocaleString('ro-RO') },
    ],
    [cleanMoney, dirtyMoney, inventory],
  );

  return (
    <div className="min-h-screen bg-[#110d28] px-4 pb-10 pt-24 text-white sm:px-6">
      <div className="mx-auto max-w-[1120px] rounded-2xl border border-white/15 bg-[#171438]/70 p-4 shadow-[0_25px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-6">
        <h1 className="text-center text-4xl font-black uppercase tracking-tight text-white">Farmat</h1>
        <p className="mt-2 text-center text-sm text-white/60">Simulator economic demo (non-oficial).</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {totalStatus.map((item) => (
            <div key={item.label} className="rounded-xl border border-white/15 bg-black/25 p-3 text-center">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">{item.label}</p>
              <p className="mt-1 text-2xl font-black text-white">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {(Object.keys(actions) as ActionKey[]).map((key) => {
            const action = actions[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => runAction(key)}
                disabled={!canRun}
                className="rounded-xl border border-violet-300/30 bg-violet-500/15 p-4 text-left transition hover:bg-violet-500/20 disabled:opacity-50"
              >
                <p className="text-base font-black">{action.title}</p>
                <p className="mt-1 text-sm text-white/70">Durata: {action.duration}s</p>
                <p className="text-sm text-white/70">Reward: {action.reward.toLocaleString('ro-RO')} {action.unit}</p>
                <p className="text-sm text-white/70">Timp joc: {action.timeLost}</p>
                <p className="text-sm text-white/70">Risc control: {action.risk}%</p>
              </button>
            );
          })}
        </div>

        <div className="mt-6 rounded-xl border border-white/15 bg-black/25 p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white/60">Vanzare</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={sellBulk} className="rounded-lg bg-emerald-500/80 px-4 py-2 text-sm font-bold" disabled={!inventory}>
              Vanzare bulk (2300/buc)
            </button>
            <button type="button" onClick={delivery} className="rounded-lg bg-sky-500/80 px-4 py-2 text-sm font-bold" disabled={inventory < 100}>
              Livrare 100 buc (3179/buc)
            </button>
            <button type="button" onClick={washMoney} className="rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-bold text-black" disabled={!dirtyMoney}>
              Spala bani (65%)
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-[#0a0a20]/75 p-4 text-center">
          <p className="text-sm text-white/75">{message}</p>
          {activeAction ? <p className="mt-1 text-lg font-black text-violet-300">{timer}s</p> : null}
        </div>
      </div>
    </div>
  );
}
