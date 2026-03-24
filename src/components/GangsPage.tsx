import { useEffect, useMemo, useState } from 'react';
import SharedStatsPanel from './SharedStatsPanel';
import PageDisclaimer from './PageDisclaimer';

const GAME_KEY = 'luck_game_state_v1';
const GAME_SALT = 'stifyy-ogromania-salt';
const LEAVE_INTERVAL_MS = 10 * 60 * 1000;

const MEMBER_POOL = [
  'Enzo', 'Fifi', 'Adi', 'Camataru', 'Capdemied', 'Fra', 'Tavi', 'Babal', 'Nacho', 'dexter', 'Sebi', 'Darius',
  'Fulger', 'Bal', 'Pix', 'Edi', 'radu', 'Danut', 'Hoodie', 'sensi', 'boca', 'Kinder', 'Nicusy', 'Palvanu',
];

const LEVELS = [
  { name: 'Nerecunoscut', maxMembers: 10, nextDirty: 300_000_000 },
  { name: 'Recunoscut', maxMembers: 15, nextDirty: 1_000_000_000 },
  { name: 'Neoficiala', maxMembers: 24, nextDirty: 10_000_000_000 },
  { name: 'Oficiala', maxMembers: 34, nextDirty: null },
];

type GangAction = 'collect' | 'white' | 'blue';

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

export default function GangsPage() {
  const saved = typeof window !== 'undefined' ? loadGameState() : null;
  const [gangNameInput, setGangNameInput] = useState('');
  const [popup, setPopup] = useState<string | null>(null);
  const [actionTimer, setActionTimer] = useState(0);
  const [actionType, setActionType] = useState<GangAction | null>(null);
  const [recruitTimer, setRecruitTimer] = useState(0);

  const [cashBalance, setCashBalance] = useState(Number(saved?.cashBalance ?? 1_000_000));
  const [baniMurdari, setBaniMurdari] = useState(Number(saved?.baniMurdari ?? 0));

  const [gangData, setGangData] = useState({
    name: String(saved?.gangData?.name ?? ''),
    members: Array.isArray(saved?.gangData?.members) ? saved.gangData.members.filter((v: unknown) => typeof v === 'string') : [],
    frunze: Number(saved?.gangData?.frunze ?? 0),
    white: Number(saved?.gangData?.white ?? 0),
    blue: Number(saved?.gangData?.blue ?? 0),
    dirtyEarned: Number(saved?.gangData?.dirtyEarned ?? 0),
    lastLeaveAt: Number(saved?.gangData?.lastLeaveAt ?? Date.now()),
    onlineNow: Number(saved?.gangData?.onlineNow ?? 0),
  });

  const formed = Boolean(gangData.name);
  const totalCars = useMemo(() => {
    const ownedCars = saved?.ownedCars ?? loadGameState()?.ownedCars ?? {};
    return ['audi_a4', 'rs7', 'p1', 'lfa'].reduce((sum, key) => sum + Number(ownedCars?.[key] ?? 0), 0);
  }, [saved]);

  const levelIndex = gangData.dirtyEarned >= 10_000_000_000 ? 3 : gangData.dirtyEarned >= 1_000_000_000 ? 2 : gangData.dirtyEarned >= 300_000_000 ? 1 : 0;
  const level = LEVELS[levelIndex];
  const maxMembers = level.maxMembers;
  const activeWorkers = Math.min(gangData.members.length, totalCars);

  const persist = (nextGangData = gangData, nextCash = cashBalance, nextDirty = baniMurdari) => {
    const existing = loadGameState() || {};
    saveGameState({
      ...existing,
      cashBalance: nextCash,
      baniCurati: nextCash,
      baniMurdari: nextDirty,
      gangData: nextGangData,
    });
  };

  const applyLeaves = () => {
    if (!formed || gangData.members.length === 0) return;
    const now = Date.now();
    const elapsed = now - gangData.lastLeaveAt;
    if (elapsed < LEAVE_INTERVAL_MS) return;
    const leaves = Math.floor(elapsed / LEAVE_INTERVAL_MS);
    if (leaves <= 0) return;
    const nextMembers = gangData.members.slice(0, Math.max(0, gangData.members.length - leaves));
    const nextGangData = { ...gangData, members: nextMembers, lastLeaveAt: gangData.lastLeaveAt + leaves * LEAVE_INTERVAL_MS };
    setGangData(nextGangData);
    persist(nextGangData);
  };

  useEffect(() => {
    const interval = window.setInterval(() => {
      applyLeaves();
      setActionTimer((current) => Math.max(0, current - 1));
      setRecruitTimer((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  });

  useEffect(() => {
    persist();
  }, [gangData, cashBalance, baniMurdari]); // eslint-disable-line react-hooks/exhaustive-deps

  const pushPopup = (text: string) => {
    setPopup(text);
    window.setTimeout(() => setPopup(null), 2400);
  };

  const formGang = () => {
    if (formed) return;
    if (!gangNameInput.trim()) {
      pushPopup('Pune un nume pentru gang.');
      return;
    }
    if (baniMurdari < 10_000_000) {
      pushPopup('Ai nevoie de 10.000.000 murdari pentru formare.');
      return;
    }
    const starters = MEMBER_POOL.slice(0, 4);
    const nextDirty = baniMurdari - 10_000_000;
    const nextGangData = {
      ...gangData,
      name: gangNameInput.trim(),
      members: starters,
      lastLeaveAt: Date.now(),
    };
    setBaniMurdari(nextDirty);
    setGangData(nextGangData);
    pushPopup('Gang format cu succes.');
  };

  const startRecruit = () => {
    if (!formed || actionType || recruitTimer > 0) return;
    if (gangData.members.length >= maxMembers) {
      pushPopup('Ai atins limita de membri pentru nivelul curent.');
      return;
    }
    const duration = 10 + Math.floor(Math.random() * 21);
    setRecruitTimer(duration);

    window.setTimeout(() => {
      setGangData((current) => {
        const used = new Set(current.members);
        const candidate = MEMBER_POOL.find((name) => !used.has(name));
        if (!candidate) return current;
        if (current.members.length >= maxMembers) return current;
        const next = { ...current, members: [...current.members, candidate] };
        pushPopup(`L-ai recrutat pe ${candidate}.`);
        return next;
      });
    }, duration * 1000);
  };

  const runGangAction = (type: GangAction) => {
    if (!formed || actionType || recruitTimer > 0) return;
    if (activeWorkers <= 0) {
      pushPopup('Ai nevoie de mașini în stoc pentru membri.');
      return;
    }

    const online = Math.max(1, Math.floor(activeWorkers * (0.5 + Math.random() * 0.5)));
    const duration = 5;
    const needsFrunze = type === 'white' ? 1200 * online : 0;
    const needsWhite = type === 'blue' ? 400 * online : 0;
    const needsDirty = type === 'white' ? 900_000 * online : type === 'blue' ? 100_000 * online : 0;
    if (gangData.frunze < needsFrunze) {
      pushPopup(`Ai nevoie de ${needsFrunze.toLocaleString('ro-RO')} frunze.`);
      return;
    }
    if (gangData.white < needsWhite) {
      pushPopup(`Ai nevoie de ${needsWhite.toLocaleString('ro-RO')} alb.`);
      return;
    }
    if (baniMurdari < needsDirty) {
      pushPopup(`Nu ai ${needsDirty.toLocaleString('ro-RO')} bani murdari.`);
      return;
    }

    setActionType(type);
    setActionTimer(duration);
    setGangData((current) => ({ ...current, onlineNow: online }));

    window.setTimeout(() => {
      const razia = Math.random() < 0.1;
      if (razia) {
        setGangData((current) => ({ ...current, frunze: 0, white: 0, blue: 0, onlineNow: 0 }));
        pushPopup('A VENIT RAZIIIAAAA!!! Gang-ul a pierdut tot stocul.');
        setActionType(null);
        setActionTimer(0);
        return;
      }

      if (type === 'collect') {
        setGangData((current) => ({ ...current, frunze: current.frunze + 1200 * online, onlineNow: 0 }));
      }
      if (type === 'white') {
        setGangData((current) => ({
          ...current,
          frunze: current.frunze - 1200 * online,
          white: current.white + 400 * online,
          onlineNow: 0,
        }));
        setBaniMurdari((current) => current - needsDirty);
      }
      if (type === 'blue') {
        setGangData((current) => ({
          ...current,
          white: current.white - 400 * online,
          blue: current.blue + 800 * online,
          onlineNow: 0,
        }));
        setBaniMurdari((current) => current - needsDirty);
      }
      pushPopup(`Acțiune finalizată cu ${online} membri online.`);
      setActionType(null);
      setActionTimer(0);
    }, duration * 1000);
  };

  const sellGangBlue = () => {
    if (!formed || gangData.blue <= 0) return;
    const gain = gangData.blue * 2300;
    setBaniMurdari((current) => current + gain);
    setGangData((current) => ({ ...current, blue: 0, dirtyEarned: current.dirtyEarned + gain }));
    pushPopup(`Vânzare gang: +${gain.toLocaleString('ro-RO')} murdari.`);
  };

  return (
    <div className="min-h-screen bg-[#110d28] px-4 pb-10 pt-20 text-white sm:px-6">
      <div className="mx-auto grid max-w-[1460px] grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-2xl border border-white/15 bg-[#171438]/72 p-4 shadow-[0_25px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-6">
          <h1 className="text-center text-4xl font-black uppercase tracking-tight">Gangs</h1>
          {!formed ? (
            <div className="mx-auto mt-6 max-w-xl rounded-xl border border-white/15 bg-black/25 p-4">
              <p className="text-sm text-white/75">Formează Gang Nerecunoscut (cost: 10.000.000 murdari)</p>
              <input value={gangNameInput} onChange={(e) => setGangNameInput(e.target.value)} placeholder="Nume gang" className="mt-3 w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2" />
              <button type="button" onClick={formGang} className="mt-3 w-full rounded-lg bg-rose-500/80 px-4 py-2 font-black">Formează gang</button>
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <Card label="Gang" value={gangData.name} />
                <Card label="Nivel" value={level.name} />
                <Card label="Membri" value={`${gangData.members.length}/${maxMembers}`} />
                <Card label="Membri cu mașină" value={`${activeWorkers}`} />
                <Card label="Online curent" value={`${gangData.onlineNow}`} />
                <Card label="Dirty făcut total" value={`${gangData.dirtyEarned.toLocaleString('ro-RO')} $`} />
              </div>
              <p className="mt-3 text-sm text-white/70">
                {level.nextDirty ? `Următor nivel la ${level.nextDirty.toLocaleString('ro-RO')} murdari.` : 'Nivel maxim atins.'}
              </p>

              <div className="mt-4 rounded-xl border border-white/15 bg-black/25 p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white/60">Recrutare</p>
                <button type="button" onClick={startRecruit} disabled={recruitTimer > 0 || actionType !== null} className={`mt-3 rounded-lg px-4 py-2 font-black ${recruitTimer > 0 || actionType ? 'bg-[#2a2744] text-white/50' : 'bg-cyan-500/80'}`}>
                  {recruitTimer > 0 ? `Caută om... ${recruitTimer}s` : 'Caută om (10-30s)'}
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <ActionButton title="Farm frunze gang" detail="+1200 / om online" onClick={() => runGangAction('collect')} disabled={Boolean(actionType) || recruitTimer > 0} />
                <ActionButton title="Procesare alb gang" detail="1200 frunze + 900k / om online" onClick={() => runGangAction('white')} disabled={Boolean(actionType) || recruitTimer > 0} />
                <ActionButton title="Procesare albastru gang" detail="400 alb + 100k / om online" onClick={() => runGangAction('blue')} disabled={Boolean(actionType) || recruitTimer > 0} />
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                <Card label="Frunze gang" value={gangData.frunze.toLocaleString('ro-RO')} />
                <Card label="Alb gang" value={gangData.white.toLocaleString('ro-RO')} />
                <Card label="Albastru gang" value={gangData.blue.toLocaleString('ro-RO')} />
                <button type="button" onClick={sellGangBlue} className={`rounded-xl border border-white/15 p-3 text-sm font-black ${gangData.blue > 0 ? 'bg-emerald-500/70' : 'bg-[#2a2744] text-white/50'}`} disabled={gangData.blue <= 0}>
                  Vinde tot blue
                </button>
              </div>

              <div className="mt-5 rounded-xl border border-white/15 bg-black/25 p-3">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white/60">Membri</p>
                <p className="mt-2 text-sm text-white/75">{gangData.members.join(', ') || '-'}</p>
              </div>
            </>
          )}

          {actionType ? (
            <div className="mt-4 rounded-xl border border-violet-300/30 bg-violet-500/15 p-4 text-center">
              <p className="text-sm text-white/75">Gang în acțiune...</p>
              <p className="mt-1 text-2xl font-black text-violet-200">{actionTimer}s</p>
            </div>
          ) : null}
        </div>
        <SharedStatsPanel />
      </div>
      <div className="mx-auto mt-5 max-w-[1460px]"><PageDisclaimer /></div>

      {popup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={() => setPopup(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-white/25 bg-[#1a1635] px-5 py-5 text-center text-base font-semibold text-white shadow-xl">
            {popup}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-black/25 p-3 text-center">
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">{label}</p>
      <p className="mt-1 text-base font-black text-white">{value}</p>
    </div>
  );
}

function ActionButton({
  title,
  detail,
  onClick,
  disabled,
}: {
  title: string;
  detail: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`rounded-xl border border-white/15 p-4 text-left ${disabled ? 'bg-[#2a2744] text-white/50' : 'bg-gradient-to-br from-fuchsia-500/25 to-violet-700/15 hover:brightness-110'}`}>
      <p className="text-base font-black">{title}</p>
      <p className="mt-1 text-sm">{detail}</p>
    </button>
  );
}
