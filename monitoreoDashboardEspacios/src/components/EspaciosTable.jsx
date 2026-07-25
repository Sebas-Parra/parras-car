import EstadoBadge from './EstadoBadge.jsx';
import EstadoSelect from './EstadoSelect.jsx';
import { ESTADO_MAP_INVERSE } from '../api.js';

const EspaciosTable = ({
  espacios,
  cargando,
  canEditStatus,
  onStatusChange,
  espaciosConTicketActivo,
  canDelete,
  onDelete,
}) => {
  if (cargando) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
        Cargando espacios...
      </div>
    );
  }

  if (espacios.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
        No hay espacios que coincidan con los filtros.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Código
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Zona
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tipo
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Estado
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                ID
              </th>
              {canDelete && <th scope="col" className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {espacios.map((espacio) => (
              <tr key={espacio.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{espacio.nombre || 'Sin nombre'}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{espacio.nombreZona || 'N/A'}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{espacio.tipo || 'N/A'}</td>
                <td className="px-4 py-3">
                  {canEditStatus && !espaciosConTicketActivo.has(espacio.id) ? (
                    <EstadoSelect
                      value={ESTADO_MAP_INVERSE[espacio.estado] ?? espacio.estado}
                      onChange={(nuevoEstado) => onStatusChange(espacio.id, nuevoEstado)}
                    />
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <EstadoBadge estado={espacio.estado} />
                      {espaciosConTicketActivo.has(espacio.id) && (
                        <span title="Hay un ticket activo — pagalo o anulalo en Tickets para liberar el espacio" className="text-slate-400">
                          🔒
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{espacio.id.slice(0, 8)}</td>
                {canDelete && (
                  <td className="px-4 py-3 text-right text-sm">
                    {!espaciosConTicketActivo.has(espacio.id) && (
                      <button
                        type="button"
                        onClick={() => onDelete(espacio)}
                        className="font-medium text-red-600 hover:text-red-800"
                      >
                        Desactivar
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EspaciosTable;
