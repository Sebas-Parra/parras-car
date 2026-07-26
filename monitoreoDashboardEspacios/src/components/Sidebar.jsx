import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { IconLayers, IconMap, IconUsers, IconCar, IconClipboard, IconTicket, IconShield } from './icons.jsx';

const NAV_ITEMS = [
  { to: '/espacios', label: 'Espacios', Icon: IconLayers },
  { to: '/zonas', label: 'Zonas', Icon: IconMap },
  { to: '/vehiculos', label: 'Vehículos', Icon: IconCar },
  { to: '/asignaciones', label: 'Asignaciones', Icon: IconClipboard },
  { to: '/tickets', label: 'Tickets', Icon: IconTicket },
  { to: '/usuarios', label: 'Usuarios', Icon: IconUsers, roles: ['admin', 'root'] },
  { to: '/auditoria', label: 'Auditoría', Icon: IconShield, roles: ['admin', 'root'] },
];

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
  }`;

const Sidebar = () => {
  const { hasRole } = useAuth();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:shrink-0 bg-slate-900 text-slate-100">
      <div className="flex items-center gap-2 border-b border-slate-800 px-6 py-5">
        <span className="text-2xl">🅿️</span>
        <div>
          <p className="text-sm font-semibold tracking-wide text-white">Parras Car</p>
          <p className="text-xs text-slate-400">Panel de monitoreo</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.filter((item) => !item.roles || hasRole(...item.roles)).map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={linkClass}>
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-800 px-6 py-4 text-xs text-slate-500">v1.0 · React + Vite</div>
    </aside>
  );
};

export default Sidebar;
