const formatDate = (date) => (date ? date.toLocaleString('es-ES', { hour12: false }) : '--');

const Topbar = ({ connected, lastUpdate }) => (
  <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
    <div>
      <h1 className="text-lg font-semibold text-slate-900">Espacios de Estacionamiento</h1>
      <p className="text-sm text-slate-500">Estado en tiempo real de los espacios registrados</p>
    </div>
    <div className="flex items-center gap-4">
      <span className="text-xs text-slate-400">Última actualización: {formatDate(lastUpdate)}</span>
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
          connected
            ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
            : 'bg-red-50 text-red-700 ring-red-600/10'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
        {connected ? 'Conectado' : 'Desconectado'}
      </span>
    </div>
  </header>
);

export default Topbar;
