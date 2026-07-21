export type CityIconName =
  | 'home'
  | 'profile'
  | 'leaf'
  | 'moon'
  | 'plane'
  | 'pizza'
  | 'fish'
  | 'roulette'
  | 'inventory'
  | 'car'
  | 'market'
  | 'gangs'
  | 'leaderboard'
  | 'menu'
  | 'close'
  | 'wallet'
  | 'coin'
  | 'fragment'
  | 'garage'
  | 'bag'
  | 'boost'
  | 'edit'
  | 'clock'
  | 'route'
  | 'package'
  | 'check'
  | 'refresh'
  | 'logout'
  | 'login'
  | 'alert'
  | 'star';

type CityIconProps = {
  name: CityIconName;
  className?: string;
  strokeWidth?: number;
};

export default function CityIcon({ name, className = 'h-5 w-5', strokeWidth = 1.8 }: CityIconProps) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth,
  };

  const shape = (() => {
    switch (name) {
      case 'home':
        return <><path d="m3.5 10 8.5-7 8.5 7" {...common} /><path d="M5.5 9v11h13V9M9.5 20v-6h5v6" {...common} /></>;
      case 'profile':
        return <><circle cx="12" cy="8" r="3.25" {...common} /><path d="M5.75 19c.7-3.2 2.8-5 6.25-5s5.55 1.8 6.25 5" {...common} /></>;
      case 'leaf':
        return <><path d="M19 4.5C11.5 4.5 6 8.5 6 14.1c0 2.6 1.8 4.4 4.4 4.4C16 18.5 19 12.5 19 4.5Z" {...common} /><path d="M5 20c2-4.5 5.4-7.8 10.6-10" {...common} /></>;
      case 'moon':
        return <path d="M18.5 15.2A7.5 7.5 0 0 1 8.8 5.5 7.5 7.5 0 1 0 18.5 15.2Z" {...common} />;
      case 'plane':
        return <><path d="m3 11 18-7-7 18-2.4-7.6L3 11Z" {...common} /><path d="m11.6 14.4 4-4" {...common} /></>;
      case 'pizza':
        return <><path d="M4.2 5.5 20 4l-7.1 16-8.7-14.5Z" {...common} /><path d="M5.4 8.2c4.4-2 8.7-2.4 13-1.2" {...common} /><circle cx="10" cy="10.5" r="1" fill="currentColor" /><circle cx="13.5" cy="14" r="1" fill="currentColor" /></>;
      case 'fish':
        return <><path d="M4 12c3-4.5 8.2-6 13-2.5L21 7v10l-4-2.5C12.2 18 7 16.5 4 12Z" {...common} /><circle cx="14" cy="11" r=".8" fill="currentColor" /><path d="M7 12H3" {...common} /></>;
      case 'roulette':
        return <><circle cx="12" cy="12" r="8.5" {...common} /><circle cx="12" cy="12" r="2" {...common} /><path d="M12 3.5V10M12 14v6.5M3.5 12H10M14 12h6.5M6 6l4.6 4.6M13.4 13.4 18 18M18 6l-4.6 4.6M10.6 13.4 6 18" {...common} /></>;
      case 'inventory':
        return <><path d="m4 8 8-4 8 4-8 4-8-4Z" {...common} /><path d="M4 8v8l8 4 8-4V8M12 12v8" {...common} /></>;
      case 'car':
        return <><path d="M4 15v-3.5l2-5h12l2 5V15" {...common} /><path d="M5 11.5h14M7 15h10" {...common} /><circle cx="7" cy="16.5" r="1.5" {...common} /><circle cx="17" cy="16.5" r="1.5" {...common} /></>;
      case 'market':
        return <><path d="M4 9h16l-1.3-5H5.3L4 9Z" {...common} /><path d="M5 9v11h14V9M9 20v-6h6v6" {...common} /><path d="M4 9c0 1.5 1 2.5 2.5 2.5S9 10.5 9 9c0 1.5 1 2.5 3 2.5s3-1 3-2.5c0 1.5 1 2.5 2.5 2.5S20 10.5 20 9" {...common} /></>;
      case 'gangs':
        return <><circle cx="9" cy="9" r="3" {...common} /><circle cx="17" cy="10" r="2.4" {...common} /><path d="M3.5 19c.5-3.1 2.3-4.8 5.5-4.8s5 1.7 5.5 4.8M14.5 15.2c2.9-.5 4.9.8 5.8 3.8" {...common} /></>;
      case 'leaderboard':
        return <><path d="M4 20V11h4v9M10 20V5h4v15M16 20v-7h4v7" {...common} /><path d="M3 20h18" {...common} /></>;
      case 'menu':
        return <path d="M5 7h14M5 12h14M5 17h14" {...common} />;
      case 'close':
        return <path d="m6 6 12 12M18 6 6 18" {...common} />;
      case 'wallet':
        return <><path d="M4 7.5h14.5A1.5 1.5 0 0 1 20 9v9H5.5A1.5 1.5 0 0 1 4 16.5v-9Z" {...common} /><path d="M4 8V6a2 2 0 0 1 2-2h11v3.5M15 12h5" {...common} /><circle cx="16" cy="12" r=".6" fill="currentColor" /></>;
      case 'coin':
        return <><circle cx="12" cy="12" r="8" {...common} /><path d="M14.8 8.8c-.7-.7-1.7-1.1-2.8-1.1-1.7 0-3 .9-3 2.2 0 3.1 6.2 1.3 6.2 4.2 0 1.4-1.3 2.3-3.2 2.3-1.3 0-2.4-.4-3.2-1.2M12 6.5v11" {...common} /></>;
      case 'fragment':
        return <path d="m12 3 3 5.2 5.5 1.1-3.8 4.2.7 5.8-5.4-2.4-5.4 2.4.7-5.8-3.8-4.2L9 8.2 12 3Z" {...common} />;
      case 'garage':
        return <><path d="M3.5 20V8L12 3l8.5 5v12" {...common} /><path d="M7 20v-8h10v8M7 15h10" {...common} /></>;
      case 'bag':
        return <><path d="M5 8h14l-1 12H6L5 8Z" {...common} /><path d="M9 8V6a3 3 0 0 1 6 0v2" {...common} /></>;
      case 'boost':
        return <path d="M13 2 5.5 13H11l-1 9 8-12h-5V2Z" {...common} />;
      case 'edit':
        return <><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z" {...common} /><path d="m13.5 7 3.5 3.5" {...common} /></>;
      case 'clock':
        return <><circle cx="12" cy="12" r="8.5" {...common} /><path d="M12 7v5l3.5 2" {...common} /></>;
      case 'route':
        return <><circle cx="6" cy="18" r="2" {...common} /><circle cx="18" cy="6" r="2" {...common} /><path d="M7.8 17.1c2-1.2 1.8-3.1 3.6-4.2 1.7-1.1 3.5-.2 4.8-1.7 1-1.1.8-2.3.7-3.2" {...common} /></>;
      case 'package':
        return <><path d="m4 8 8-4 8 4-8 4-8-4Z" {...common} /><path d="M4 8v8l8 4 8-4V8M12 12v8M8 6l8 4" {...common} /></>;
      case 'check':
        return <path d="m5 12.5 4 4L19 6.5" {...common} />;
      case 'refresh':
        return <><path d="M19 8a7.5 7.5 0 0 0-13-2L4 8M4 4v4h4M5 16a7.5 7.5 0 0 0 13 2l2-2M20 20v-4h-4" {...common} /></>;
      case 'logout':
        return <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" {...common} />;
      case 'login':
        return <path d="M14 5h5v14h-5M10 8l-4 4 4 4M6 12h9" {...common} />;
      case 'alert':
        return <><path d="M12 3 2.8 20h18.4L12 3Z" {...common} /><path d="M12 9v5M12 17.2v.1" {...common} /></>;
      case 'star':
        return <path d="m12 3 2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.4-4.2 6-.9L12 3Z" {...common} />;
      default:
        return null;
    }
  })();

  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>{shape}</svg>;
}
