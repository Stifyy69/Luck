import { usePlayer } from '../hooks/usePlayer';
import CityIcon from './ui/CityIcon';

type AccountHudProps = { embedded?: boolean };

export default function AccountHud({ embedded = false }: AccountHudProps) {
  const { session } = usePlayer();
  const resident = session && !session.isGuest;

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    window.dispatchEvent(new Event('luck-session-changed'));
  };

  if (!resident) {
    return (
      <a
        href="/account"
        className={embedded
          ? 'shrink-0 rounded-xl border border-[rgba(211,255,81,0.22)] bg-[rgba(211,255,81,0.08)] px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.08em] text-[var(--accent)] no-underline'
          : 'btn-primary rounded-2xl px-4 py-3 text-xs no-underline'}
      >
        {embedded ? 'Visitor' : 'Create account'}
      </a>
    );
  }

  return (
    <div className={embedded
      ? 'flex shrink-0 items-center gap-2 border-l border-white/[0.08] pl-3'
      : 'flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#0b0e0c]/90 p-1.5 shadow-2xl backdrop-blur-xl'}>
      <a href="/profile" className="flex min-w-0 items-center gap-2 no-underline">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[10px] font-black uppercase text-[#10140b]">
          {session.username.slice(0, 2)}
        </span>
        <span className="hidden min-w-0 xl:block">
          <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-white/28">ID #{session.cityId}</span>
          <span className="block max-w-[110px] truncate text-xs font-extrabold text-white">{session.username}</span>
        </span>
      </a>
      <button
        type="button"
        aria-label="Log out"
        title="Log out"
        className={embedded
          ? 'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-white/45 transition hover:bg-white/[0.06] hover:text-white'
          : 'btn-ghost rounded-xl px-3 py-2 text-[11px]'}
        onClick={() => logout().catch(() => {})}
      >
        {embedded ? <CityIcon name="logout" className="h-4 w-4" /> : 'Log out'}
      </button>
    </div>
  );
}
