const ESTADO_STYLES = {
  DISPONIBLE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  OCUPADO: 'bg-red-50 text-red-700 ring-red-600/10',
  RESERVADO: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  MANTENIMIENTO: 'bg-slate-100 text-slate-600 ring-slate-500/10',
};
const DEFAULT_STYLE = 'bg-slate-100 text-slate-600 ring-slate-500/10';

const EstadoBadge = ({ estado }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${ESTADO_STYLES[estado] ?? DEFAULT_STYLE}`}
  >
    {estado}
  </span>
);

export default EstadoBadge;
