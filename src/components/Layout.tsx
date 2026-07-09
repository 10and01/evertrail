import { Outlet, useLocation } from 'react-router-dom';
import { NavBar } from './NavBar';
import { MobileNav } from './MobileNav';

export function Layout() {
  const { pathname } = useLocation();
  const isMap = pathname === '/map';

  return (
    <div className={`flex flex-col bg-et-bg ${isMap ? 'h-screen' : 'min-h-screen'}`}>
      {!isMap && <NavBar />}
      <main className={`${isMap ? 'flex-1 p-0 overflow-hidden' : 'flex-1 container mx-auto px-4 py-6'}`}>
        <Outlet />
      </main>
      {!isMap && <MobileNav />}
    </div>
  );
}
