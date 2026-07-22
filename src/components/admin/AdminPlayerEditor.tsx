import { useEffect, useState } from 'react';
import {
  fetchAdminPlayerDetail,
  grantAdminItem,
  grantAdminMythicMember,
  resetAdminTutorial,
  setAdminVip,
  updateAdminNumeric,
  updateAdminProfile,
  type AdminNumericField,
  type AdminPlayer,
  type AdminPlayerDetail,
} from '../../lib/adminApi';
import CityIcon from '../ui/CityIcon';
import { AdminPlayerProgress, AdminPlayerSummary } from './AdminPlayerSummary';

const FIELDS: Array<{ value: AdminNumericField; label: string }> = [
  ['cleanMoney', 'Clean money'], ['flowCoins', 'FlowCoins'], ['rouletteFragments', 'Roulette fragments'],
  ['vehicleSlotsExtra', 'Extra vehicle slots'], ['cityXp', 'City XP'], ['pizzerLevel', 'Pizza level'],
  ['pizzerXp', 'Pizza XP'], ['pizzerDeliveries', 'Pizza deliveries'], ['fisherLevel', 'Fisher level'],
  ['fisherXp', 'Fisher XP'], ['fisherCatches', 'Fisher catches'], ['pilotLevel', 'Pilot level'],
  ['pilotXp', 'Pilot XP'], ['pilotFlights', 'Pilot flights'],
].map(([value, label]) => ({ value: value as AdminNumericField, label }));

const ITEMS = ['MYSTERY_BOX', 'SLOT_VEHICLE', 'VOUCHER_SHOWROOM', 'JOB_BOOST_PILOT', 'JOB_BOOST_SLEEP', 'XENON_VEHICLE', 'VIP_SILVER', 'VIP_GOLD'];

type ActionResult = { detail: AdminPlayerDetail };

export default function AdminPlayerEditor({ player, onClose, onChanged }: { player: AdminPlayer; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<AdminPlayerDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [field, setField] = useState<AdminNumericField>('cleanMoney');
  const [mode, setMode] = useState<'add' | 'set'>('add');
  const [value, setValue] = useState('100000');
  const [displayName, setDisplayName] = useState(player.displayName);
  const [itemType, setItemType] = useState('MYSTERY_BOX');
  const [quantity, setQuantity] = useState('1');
  const [mythicName, setMythicName] = useState('');

  const load = () => fetchAdminPlayerDetail(player.playerId).then((next) => {
    setDetail(next);
    setDisplayName(next.player.displayName);
  }).catch((reason: unknown) => setMessage({ text: reason instanceof Error ? reason.message : 'Could not load player.', error: true }));

  useEffect(() => { load(); }, [player.playerId]);

  const run = async (action: () => Promise<ActionResult>, success: string) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await action();
      setDetail(result.detail);
      setDisplayName(result.detail.player.displayName);
      setMessage({ text: success });
      onChanged();
    } catch (reason: unknown) {
      setMessage({ text: reason instanceof Error ? reason.message : 'Admin action failed.', error: true });
    } finally {
      setBusy(false);
    }
  };

  const current = detail?.player || player;
  const actionButton = 'btn-secondary w-full rounded-xl px-4 py-3 text-sm disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-[240] flex justify-end bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <aside className="game-scrollbar h-full w-full max-w-[680px] overflow-y-auto border-l border-white/[0.08] bg-[#090c0f]" onClick={(event) => event.stopPropagation()}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.07] bg-[#090c0f]/95 p-5 backdrop-blur-xl">
          <div className="min-w-0"><p className="section-kicker">Player control</p><h2 className="mt-1 truncate text-2xl font-black text-white">{current.displayName}</h2><p className="truncate text-[10px] text-white/28">{current.playerId}</p></div>
          <button type="button" onClick={onClose} className="btn-ghost flex h-10 w-10 items-center justify-center rounded-xl"><CityIcon name="close" className="h-5 w-5" /></button>
        </header>

        <div className="space-y-5 p-5 sm:p-6">
          {message ? <p className={`rounded-xl border p-3 text-sm font-bold ${message.error ? 'border-red-400/20 bg-red-500/[0.06] text-red-100' : 'border-emerald-400/20 bg-emerald-500/[0.06] text-emerald-100'}`}>{message.text}</p> : null}
          {!detail ? <div className="game-panel-soft p-10 text-center text-sm font-black text-white/28">Loading player...</div> : null}

          {detail ? <>
            <AdminPlayerSummary player={current} />

            <section className="game-panel-soft p-5">
              <p className="section-kicker">Core values</p><h3 className="mt-2 text-2xl font-black text-white">Add, subtract or set</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px_150px]">
                <select className="input-dark rounded-xl px-3 py-3 text-sm" value={field} onChange={(event) => setField(event.target.value as AdminNumericField)}>{FIELDS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
                <select className="input-dark rounded-xl px-3 py-3 text-sm" value={mode} onChange={(event) => setMode(event.target.value as 'add' | 'set')}><option value="add">Add / subtract</option><option value="set">Set exact</option></select>
                <input className="input-dark rounded-xl px-3 py-3 text-sm" type="number" value={value} onChange={(event) => setValue(event.target.value)} />
              </div>
              <p className="mt-2 text-[10px] text-white/28">Use a negative number in Add mode to subtract.</p>
              <button type="button" disabled={busy} onClick={() => run(() => updateAdminNumeric(current.playerId, field, mode, Number(value)), 'Value updated.')} className="btn-primary mt-4 w-full rounded-xl px-4 py-3 text-sm disabled:opacity-50">Apply change</button>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="game-panel-soft p-5"><p className="section-kicker">Identity</p><input className="input-dark mt-4 w-full rounded-xl px-3 py-3 text-sm" value={displayName} onChange={(event) => setDisplayName(event.target.value.slice(0, 32))} /><button type="button" disabled={busy} onClick={() => run(() => updateAdminProfile(current.playerId, displayName), 'Identity updated.')} className={`${actionButton} mt-3`}>Save identity</button></div>
              <div className="game-panel-soft p-5"><p className="section-kicker">VIP access</p><h3 className="mt-2 text-xl font-black text-white">{detail.vip.active ? detail.vip.label : 'No active VIP'}</h3><p className="mt-2 text-xs text-white/35">Silver 5m, Gold 10m</p><div className="mt-4 grid grid-cols-3 gap-2"><button disabled={busy} onClick={() => run(() => setAdminVip(current.playerId, 'VIP_SILVER'), 'VIP Silver activated.')} className="btn-ghost rounded-xl py-2 text-[10px]">Silver</button><button disabled={busy} onClick={() => run(() => setAdminVip(current.playerId, 'VIP_GOLD'), 'VIP Gold activated.')} className="btn-primary rounded-xl py-2 text-[10px]">Gold</button><button disabled={busy} onClick={() => run(() => setAdminVip(current.playerId, 'NONE'), 'VIP revoked.')} className="rounded-xl border border-red-400/20 text-[10px] text-red-200">Revoke</button></div></div>
            </section>

            <section className="game-panel-soft p-5"><p className="section-kicker">Inventory grant</p><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px]"><select className="input-dark rounded-xl px-3 py-3 text-sm" value={itemType} onChange={(event) => setItemType(event.target.value)}>{ITEMS.map((entry) => <option key={entry}>{entry}</option>)}</select><input className="input-dark rounded-xl px-3 py-3 text-sm" type="number" min={1} max={100} value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div><button type="button" disabled={busy} onClick={() => run(() => grantAdminItem(current.playerId, itemType, Number(quantity)), 'Item granted.')} className={`${actionButton} mt-3`}>Grant item</button></section>

            <section className="rounded-[22px] border border-rose-300/20 bg-rose-500/[0.045] p-5">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-rose-200/70">Event exclusive</p>
              <h3 className="mt-2 text-2xl font-black text-white">Grant Mythic gang member</h3>
              <p className="mt-2 text-xs leading-relaxed text-white/38">Mythic members cannot appear through normal recruitment. The player must already have a synchronized gang with an available member slot.</p>
              <input className="input-dark mt-4 w-full rounded-xl px-3 py-3 text-sm" placeholder="Optional first name" value={mythicName} onChange={(event) => setMythicName(event.target.value.slice(0, 24))} />
              <button
                type="button"
                disabled={busy || !detail.gang}
                onClick={() => run(() => grantAdminMythicMember(current.playerId, mythicName), 'Mythic event member granted.')}
                className="mt-3 w-full rounded-xl border border-rose-300/20 bg-rose-500/15 px-4 py-3 text-sm font-black text-rose-100 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {detail.gang ? 'Grant Mythic member' : 'Player has no synchronized gang'}
              </button>
            </section>

            <AdminPlayerProgress detail={detail} busy={busy} onReset={() => run(() => resetAdminTutorial(current.playerId), 'Tutorial reset.')} />
          </> : null}
        </div>
      </aside>
    </div>
  );
}
