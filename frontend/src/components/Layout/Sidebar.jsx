import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Kanban, X, Menu, Upload } from 'lucide-react';
import { useState } from 'react';
import KnightIcon from '../ui/KnightIcon';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/leads', label: 'Leads', icon: Users },
  { to: '/pipeline', label: 'Pipeline', icon: Kanban },
  { to: '/import-leads', label: 'Importar Leads', icon: Upload },
];

function SidebarContent({ mobileOpen, setMobileOpen, navLinkClass }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-dark-600 flex items-center gap-3">
        <KnightIcon className="w-9 h-9 flex-shrink-0" />
        <div>
          <h1 className="text-white font-bold text-lg leading-tight">Checkmate</h1>
          <p className="text-gold-300 text-xs mt-0.5">CRM · Gestão de Leads</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={navLinkClass} onClick={() => setMobileOpen(false)}>
            <Icon className="w-5 h-5 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-dark-600">
        <p className="text-gold-400 text-xs text-center">Checkmate CRM · Desktop</p>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-gold-700 text-dark-900'
        : 'text-gold-100 hover:bg-dark-600/60 hover:text-white'
    }`;

  return (
    <>
      {/* Mobile header */}
      <header className="fixed top-0 left-0 right-0 z-50 lg:hidden bg-dark-800 border-b border-dark-600 h-16 flex items-center px-4">
        <button
          className="bg-gold-700 text-dark-900 p-2 rounded-lg hover:bg-gold-500 transition-colors"
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div className="ml-3 flex items-center gap-2">
          <KnightIcon className="w-7 h-7" />
          <h1 className="text-white font-bold text-lg leading-tight">Checkmate</h1>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden mt-16"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-dark-800 transform transition-transform duration-200 ease-in-out lg:hidden mt-16 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} navLinkClass={navLinkClass} />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:flex flex-col w-64 bg-dark-800 min-h-screen flex-shrink-0 inset-y-0 left-0 z-30">
        <SidebarContent mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} navLinkClass={navLinkClass} />
      </aside>
    </>
  );
}
