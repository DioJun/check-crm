import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Kanban, X, Menu, Upload, ChevronDown, MessageSquare, BookOpen, BarChart3, Settings, Globe, PlusCircle, Rocket } from 'lucide-react';
import { useState } from 'react';
import KnightIcon from '../ui/KnightIcon';

// Itens gerais (base da plataforma — não pertencem a nenhum módulo)
const generalItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

// Módulos do sistema. Cada módulo é um menu pai com submenus.
// Para adicionar um novo módulo, basta adicionar um item aqui.
const modules = [
  {
    id: 'crm',
    label: 'CRM',
    icon: Users,
    defaultPath: '/leads',
    children: [
      { to: '/leads', label: 'Leads', icon: Users },
      { to: '/pipeline', label: 'Pipeline', icon: Kanban },
      { to: '/import-leads', label: 'Importar Leads', icon: Upload },
    ],
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: MessageSquare,
    defaultPath: '/whatsapp',
    children: [
      { to: '/whatsapp', label: 'Assistente WhatsApp', icon: MessageSquare },
    ],
  },
  {
    id: 'sites',
    label: 'Sites',
    icon: Globe,
    defaultPath: '/sites',
    children: [
      { to: '/sites', label: 'Sites de Demo', icon: Globe },
      { to: '/sites/novo', label: 'Criar Site', icon: PlusCircle },
      { to: '/sites/config', label: 'Configurações', icon: Rocket },
    ],
  },
  {
    id: 'ia',
    label: 'IA',
    icon: BookOpen,
    defaultPath: '/ai/knowledge',
    children: [
      { to: '/ai/knowledge', label: 'Base de Conhecimento', icon: BookOpen },
      { to: '/ai/analytics', label: 'Performance da IA', icon: BarChart3 },
      { to: '/ai/settings', label: 'Aprendizado', icon: Settings },
    ],
  },
];

// Detecta se uma rota pertence a um módulo
function isPathInModule(path, module) {
  return module.children.some((child) => path.startsWith(child.to));
}

function SidebarContent({ setMobileOpen, navLinkClass, subLinkClass }) {
  const location = useLocation();
  const [expandedModule, setExpandedModule] = useState(() => {
    // Expandir automaticamente o módulo da rota atual
    const active = modules.find((m) => isPathInModule(location.pathname, m));
    return active ? active.id : null;
  });

  function toggleModule(id) {
    setExpandedModule((current) => (current === id ? null : id));
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-dark-600 flex items-center gap-3">
        <KnightIcon className="w-9 h-9 flex-shrink-0" />
        <div>
          <h1 className="text-white font-bold text-lg leading-tight">Checkmate</h1>
          <p className="text-gold-300 text-xs mt-0.5">Plataforma Modular</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {/* Itens gerais */}
        {generalItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={navLinkClass} onClick={() => setMobileOpen(false)}>
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}

        {/* Separador */}
        <div className="pt-3 mt-3 border-t border-dark-600/50" />

        {/* Módulos */}
        {modules.map((mod) => {
          const isExpanded = expandedModule === mod.id;
          const isActive = isPathInModule(location.pathname, mod);
          return (
            <div key={mod.id} className="mb-1">
              <button
                onClick={() => toggleModule(mod.id)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive && !isExpanded
                    ? 'bg-gold-700 text-dark-900'
                    : 'text-gold-100 hover:bg-dark-600/60 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <mod.icon className="w-5 h-5 flex-shrink-0" />
                  {mod.label}
                </span>
                <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              {/* Submenus do módulo */}
              {isExpanded && (
                <div className="ml-5 mt-1 pl-3 border-l border-dark-600/50 space-y-0.5">
                  {mod.children.map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      className={subLinkClass}
                      onClick={() => setMobileOpen(false)}
                    >
                      <child.icon className="w-4 h-4 flex-shrink-0" />
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-dark-600">
        <p className="text-gold-400 text-xs text-center">Checkmate · Desktop</p>
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

  const subLinkClass = ({ isActive }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-gold-700/90 text-dark-900'
        : 'text-gold-200/80 hover:bg-dark-600/40 hover:text-white'
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
        <SidebarContent mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} navLinkClass={navLinkClass} subLinkClass={subLinkClass} />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:flex flex-col w-64 bg-dark-800 min-h-screen flex-shrink-0 inset-y-0 left-0 z-30">
        <SidebarContent mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} navLinkClass={navLinkClass} subLinkClass={subLinkClass} />
      </aside>
    </>
  );
}
