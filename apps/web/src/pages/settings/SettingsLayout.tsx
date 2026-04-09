import { NavLink, Outlet } from 'react-router-dom';
import { User, Building2 } from 'lucide-react';
import { clsx } from 'clsx';

const links = [
  { to: '/settings/profile', label: 'Profile', icon: User },
  { to: '/settings/workspace', label: 'Workspace', icon: Building2 },
];

export default function SettingsLayout() {
  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
      <p className="text-gray-600 mb-8">Manage your account and the active workspace.</p>
      <div className="flex flex-col md:flex-row gap-8">
        <nav className="md:w-52 shrink-0 space-y-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-100 text-brand-800'
                    : 'text-gray-700 hover:bg-gray-100',
                )
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
