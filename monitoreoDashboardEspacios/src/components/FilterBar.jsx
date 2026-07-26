import Button from './Button.jsx';
import { IconSearch, IconX } from './icons.jsx';

const ESTADOS_FILTRO = [
  { value: 'TODOS', label: 'Todos los estados' },
  { value: 'DISPONIBLE', label: 'Disponible' },
  { value: 'OCUPADO', label: 'Ocupado' },
  { value: 'RESERVADO', label: 'Reservado' },
  { value: 'MANTENIMIENTO', label: 'Mantenimiento' },
];

const FilterBar = ({
  search,
  onSearchChange,
  estado,
  onEstadoChange,
  zona,
  onZonaChange,
  zonas,
  hayFiltrosActivos,
  onLimpiar,
}) => (
  <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
    <div className="relative flex-1">
      <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Buscar por código o zona..."
        className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
      />
    </div>
    <select
      value={estado}
      onChange={(e) => onEstadoChange(e.target.value)}
      className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
    >
      {ESTADOS_FILTRO.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    <select
      value={zona}
      onChange={(e) => onZonaChange(e.target.value)}
      className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
    >
      <option value="TODAS">Todas las zonas</option>
      {zonas.map((z) => (
        <option key={z} value={z}>
          {z}
        </option>
      ))}
    </select>
    {hayFiltrosActivos && (
      <Button variant="ghost" size="sm" icon={IconX} onClick={onLimpiar}>
        Limpiar filtros
      </Button>
    )}
  </div>
);

export default FilterBar;
