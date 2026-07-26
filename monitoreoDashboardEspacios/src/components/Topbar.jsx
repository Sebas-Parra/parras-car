import { useAuth } from '../context/AuthContext.jsx';
import Button from './Button.jsx';
import { IconMenu, IconLogout } from './icons.jsx';

const Topbar = ({ onMenuClick }) => {
  const { username, roles, logout } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 md:hidden"
        aria-label="Abrir menú"
      >
        <IconMenu className="h-5 w-5" />
      </button>
      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-900">{username}</p>
          <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
            {roles.join(', ')}
          </span>
        </div>
        <Button variant="danger-outline" size="sm" icon={IconLogout} onClick={logout}>
          Cerrar sesión
        </Button>
      </div>
    </header>
  );
};

export default Topbar;
