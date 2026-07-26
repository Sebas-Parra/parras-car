import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import ZoneFormModal from '../components/ZoneFormModal.jsx';
import { fetchZonas, deleteZona } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const ZonasPage = () => {
  const { token, hasRole } = useAuth();
  const [zonas, setZonas] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // null | 'new' | zona object para editar

  const canManage = hasRole('admin', 'root');
  const canDelete = hasRole('root');

  const cargar = useCallback(() => {
    fetchZonas(token)
      .then(setZonas)
      .catch((err) => setError(err.message || 'No se pudieron cargar las zonas'));
  }, [token]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleDelete = async (zona) => {
    if (!window.confirm(`¿Eliminar la zona "${zona.name}"? Esta acción no se puede deshacer.`)) return;
    setError('');
    try {
      await deleteZona(zona.id, token);
      cargar();
    } catch (err) {
      setError(err.message || 'No se pudo eliminar la zona');
    }
  };

  return (
    <>
      <PageHeader title="Zonas" subtitle="Zonas de estacionamiento del sistema">
        {canManage && (
          <button
            type="button"
            onClick={() => setModal('new')}
            className="whitespace-nowrap rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            + Nueva zona
          </button>
        )}
      </PageHeader>

      {error && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" className="font-medium underline" onClick={() => setError('')}>
            Cerrar
          </button>
        </div>
      )}

      {zonas === null ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
          Cargando zonas...
        </div>
      ) : zonas.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
          No hay zonas creadas todavía.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Nombre', 'Código', 'Tipo', 'Capacidad', 'Espacios', 'Estado', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {zonas.map((z) => (
                  <tr key={z.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{z.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{z.code}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{z.type}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{z.capacity}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{z.places?.length ?? 0}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          z.status === 1
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                            : 'bg-slate-100 text-slate-600 ring-slate-500/10'
                        }`}
                      >
                        {z.status === 1 ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="space-x-3 px-4 py-3 text-right text-sm">
                      {canManage && (
                        <button type="button" onClick={() => setModal(z)} className="font-medium text-slate-600 hover:text-slate-900">
                          Editar
                        </button>
                      )}
                      {canDelete && (
                        <button type="button" onClick={() => handleDelete(z)} className="font-medium text-red-600 hover:text-red-800">
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <ZoneFormModal zona={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSaved={cargar} />
      )}
    </>
  );
};

export default ZonasPage;
