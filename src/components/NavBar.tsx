import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Footprints, Images, Map, Settings, Trophy } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { useGameStore } from '@/store/useGameStore';
import { cn } from '@/lib/utils';

const links = [
  { to: '/', label: '今天', icon: Footprints },
  { to: '/map', label: '旅程', icon: Map },
  { to: '/studio', label: '故事工坊', icon: BookOpen },
  { to: '/gallery', label: '展厅', icon: Images },
  { to: '/growth', label: '成长', icon: Trophy },
  { to: '/settings', label: '设置', icon: Settings },
];

export function NavBar() {
  const { pathname } = useLocation();
  const profile = useGameStore((s) => s.profile);

  return (
    <header className="sticky top-0 z-50 border-b-2 border-et-border bg-et-panel/90 backdrop-blur">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="brand-lockup">
          <BrandMark />
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {links.map((link) => {
            const Icon = link.icon;
            const active = link.to === '/' ? pathname === '/' : pathname.startsWith(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 text-sm border-2 border-transparent hover:border-et-gold',
                  active && 'bg-et-gold text-et-bg border-et-gold'
                )}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        {profile && (
          <div className="flex items-center gap-2 text-sm font-number">
            <span className="text-et-gold">{profile.nickname}</span>
          </div>
        )}
      </div>
    </header>
  );
}
