import type { CityProgress } from '../../lib/cityProgress';
import { careerAccessForPath } from '../../lib/cityProgress';
import CityIcon from '../ui/CityIcon';
import { NAV_GROUPS, accessPathForRoute, type RoutePath } from './navigation';

type AppSidebarProps = {
  path: RoutePath;
  open: boolean;
  progress: CityProgress | null;
  onNavigate: (path: RoutePath) => void;
  onClose: () => void;
  onOpen: () => void;
};

export default function AppSidebar({ path, open, progress, onNavigate, onClose, onOpen }: AppSidebarProps) {
  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      ) : null}

      <button
        type="button"
        onClick={onOpen}
        className={`game-panel fixed left-4 top-4 z-[75] h-11 w-11 items-center justify-center text-white md:hidden ${open ? 'hidden' : 'inline-flex'}`}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="city-navigation"
      >
        <CityIcon name="menu" className="h-5 w-5" />
      </button>

      <aside
        id="city-navigation"
        className={`city-sidebar game-scrollbar fixed inset-y-0 left-0 z-[70] flex w-[290px] flex-col overflow-y-auto transition-transform duration-200 md:left-4 md:top-4 md:h-[calc(100vh-2rem)] md:w-[252px] ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="city-brand">
          <span className="city-brand-mark">CF</span>
          <span className="min-w-0">
            <strong>CityFlow</strong>
            <small>Live city experience</small>
          </span>
          <button type="button" className="ml-auto inline-flex h-9 w-9 items-center justify-center text-white/45 md:hidden" onClick={onClose} aria-label="Close menu">
            <CityIcon name="close" className="h-4 w-4" />
          </button>
        </div>

        <div className="px-3 pt-3">
          <NavButton
            active={path === '/city'}
            description="Your next move"
            icon="home"
            label="City Hub"
            onClick={() => onNavigate('/city')}
          />
        </div>

        <nav aria-label="Main navigation" className="mt-2 px-3 pb-4">
          {NAV_GROUPS.map((group) => (
            <div className="city-nav-group" key={group.label}>
              <p>{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const access = careerAccessForPath(accessPathForRoute(item.path), progress);
                  const locked = Boolean(access && !access.unlocked);
                  return (
                    <NavButton
                      key={item.path}
                      active={path === item.path}
                      description={item.description}
                      icon={item.icon}
                      label={item.label}
                      locked={locked}
                      badge={locked ? (item.vipOnly ? 'VIP' : `Lv ${item.unlockLevel}`) : item.hint}
                      onClick={() => onNavigate(item.path)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto border-t border-white/[0.07] p-3">
          <NavButton
            active={path === '/adminpanelv2'}
            description="Demo administration"
            icon="alert"
            label="Control Center"
            onClick={() => onNavigate('/adminpanelv2')}
          />
          <button type="button" onClick={() => onNavigate('/profile')} className="city-profile-card mt-2 w-full text-left" aria-current={path === '/profile' ? 'page' : undefined}>
            <span className="city-profile-avatar">ST</span>
            <span className="min-w-0 flex-1">
              <strong>My Profile</strong>
              <small>City Level {progress?.level || 1} · {progress?.xp || 0} XP</small>
            </span>
            <CityIcon name="route" className="h-4 w-4 text-white/25" />
          </button>
        </div>
      </aside>
    </>
  );
}

type NavButtonProps = {
  active: boolean;
  badge?: string;
  description: string;
  icon: Parameters<typeof CityIcon>[0]['name'];
  label: string;
  locked?: boolean;
  onClick: () => void;
};

function NavButton({ active, badge, description, icon, label, locked = false, onClick }: NavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`city-nav-button ${active ? 'active' : ''} ${locked ? 'locked' : ''}`}
    >
      <span className="city-nav-icon"><CityIcon name={icon} className="h-[17px] w-[17px]" /></span>
      <span className="min-w-0 flex-1">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      {badge ? <em>{badge}</em> : null}
    </button>
  );
}
