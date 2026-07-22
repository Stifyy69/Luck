import CityIcon, { type CityIconName } from '../ui/CityIcon';
import type { RoutePath } from './navigation';

type MobileDockProps = {
  path: RoutePath;
  onNavigate: (path: RoutePath) => void;
  onOpenMenu: () => void;
};

const ITEMS: Array<{ path: RoutePath; label: string; icon: CityIconName }> = [
  { path: '/city', label: 'Hub', icon: 'home' },
  { path: '/pizzer', label: 'Career', icon: 'pizza' },
  { path: '/showroom', label: 'Cars', icon: 'car' },
  { path: '/gangs', label: 'Gang', icon: 'gangs' },
];

export default function MobileDock({ path, onNavigate, onOpenMenu }: MobileDockProps) {
  return (
    <nav className="city-mobile-dock" aria-label="Mobile shortcuts">
      {ITEMS.map((item) => {
        const active = item.path === '/gangs' ? path.startsWith('/gangs') : path === item.path;
        return (
          <button key={item.path} type="button" className={active ? 'active' : ''} onClick={() => onNavigate(item.path)} aria-current={active ? 'page' : undefined}>
            <CityIcon name={item.icon} className="h-[18px] w-[18px]" />
            <span>{item.label}</span>
          </button>
        );
      })}
      <button type="button" onClick={onOpenMenu}>
        <CityIcon name="menu" className="h-[18px] w-[18px]" />
        <span>More</span>
      </button>
    </nav>
  );
}
