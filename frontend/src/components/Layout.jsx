import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/history', label: 'Histórico', icon: '📋' },
  { to: '/devices', label: 'Dispositivos', icon: '📡' },
  { to: '/settings', label: 'Configurações', icon: '⚙️' },
  { to: '/profile', label: 'Perfil', icon: '👤' },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-500'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
    }`;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Topbar mobile */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 md:hidden">
        <span className="text-lg font-semibold text-brand-700 dark:text-brand-500">ThermoSense</span>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md border border-slate-300 px-3 py-1 text-sm dark:border-slate-600 dark:text-slate-200"
        >
          Menu
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={`w-full shrink-0 border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 md:block md:w-64 md:border-b-0 md:border-r md:min-h-screen ${
          mobileOpen ? 'block' : 'hidden'
        }`}
      >
        <div className="hidden px-6 py-6 md:block">
          <span className="text-xl font-semibold text-brand-700 dark:text-brand-500">ThermoSense</span>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClass} onClick={() => setMobileOpen(false)}>
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-center gap-2 px-3">
            {user?.avatarData ? (
              <img src={user.avatarData} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-500">
                {user?.fullName?.[0]?.toUpperCase() ?? '?'}
              </span>
            )}
            <p className="truncate text-xs text-slate-400 dark:text-slate-500">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            🚪 Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
