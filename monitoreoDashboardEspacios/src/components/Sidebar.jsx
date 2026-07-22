import { IconLayers } from './icons.jsx';

const Sidebar = () => (
  <aside className="hidden md:flex md:w-60 md:flex-col md:shrink-0 bg-slate-900 text-slate-100">
    <div className="flex items-center gap-2 border-b border-slate-800 px-6 py-5">
      <span className="text-2xl">🅿️</span>
      <div>
        <p className="text-sm font-semibold tracking-wide text-white">Parras Car</p>
        <p className="text-xs text-slate-400">Panel de monitoreo</p>
      </div>
    </div>
    <nav className="flex-1 px-3 py-4">
      <span className="flex items-center gap-3 rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white">
        <IconLayers className="h-4 w-4" />
        Espacios
      </span>
    </nav>
    <div className="border-t border-slate-800 px-6 py-4 text-xs text-slate-500">v1.0 · React + Vite</div>
  </aside>
);

export default Sidebar;
