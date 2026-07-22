const STAT_CONFIG = [
  { key: 'TOTAL', label: 'Total', accent: 'bg-slate-900' },
  { key: 'DISPONIBLE', label: 'Disponibles', accent: 'bg-emerald-500' },
  { key: 'OCUPADO', label: 'Ocupados', accent: 'bg-red-500' },
  { key: 'RESERVADO', label: 'Reservados', accent: 'bg-amber-500' },
  { key: 'MANTENIMIENTO', label: 'Mantenimiento', accent: 'bg-slate-400' },
];

const StatsRow = ({ stats }) => (
  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
    {STAT_CONFIG.map(({ key, label, accent }) => (
      <div key={key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${accent}`} />
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        </div>
        <p className="mt-2 text-2xl font-semibold text-slate-900">{stats[key] ?? 0}</p>
      </div>
    ))}
  </div>
);

export default StatsRow;
