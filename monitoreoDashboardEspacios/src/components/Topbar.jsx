import { useAuth } from '../context/AuthContext.jsx';

const Topbar = () => {
  const { username, roles, logout } = useAuth();

  return (
    <header className="flex items-center justify-end border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-slate-900">{username}</p>
          <p className="text-xs text-slate-500">{roles.join(', ')}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
};

export default Topbar;
