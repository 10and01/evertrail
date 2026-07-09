import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Home, Map, Share2, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { to: '/', label: '大厅', icon: Home },
  { to: '/journal', label: '记录', icon: BookOpen },
  { to: '/map', label: '地图', icon: Map },
  { to: '/chapters', label: '章节', icon: BookOpen },
  { to: '/growth', label: '成长', icon: Trophy },
  { to: '/export', label: '导出', icon: Share2 },
];

export function MobileNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-et-panel border-t-2 border-et-border md:hidden">
      <div className="flex justify-around items-center h-14">
        {links.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.to;
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
