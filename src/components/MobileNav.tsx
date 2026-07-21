import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Footprints, Images, Map, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { to: '/', label: '今天', icon: Footprints },
  { to: '/map', label: '旅程', icon: Map },
  { to: '/studio', label: '工坊', icon: BookOpen },
  { to: '/gallery', label: '展厅', icon: Images },
  { to: '/settings', label: '设置', icon: Settings },
];

export function MobileNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-et-panel border-t-2 border-et-border md:hidden">
      <div className="flex justify-around items-center h-14">
        {links.map((link) => {
          const Icon = link.icon;
          const active = link.to === '/' ? pathname === '/' : pathname.startsWith(link.to);
          return (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 text-xs',
                active ? 'text-et-gold' : 'text-et-muted'
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
