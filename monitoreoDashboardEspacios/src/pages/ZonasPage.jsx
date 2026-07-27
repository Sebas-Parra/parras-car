import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import ZoneFormModal from '../components/ZoneFormModal.jsx';
import Pagination from '../components/Pagination.jsx';
import Button from '../components/Button.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { IconPlus, IconEdit, IconTrash } from '../components/icons.jsx';
import { fetchZonas, deleteZona, TIPO_ZONA_LABELS, toEnumLabel } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const ZonasPage = () => {
  const { token, hasRole } = useAuth();
  const toast = useToast();
  const [zonas, setZonas] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modal, setModal] = useState(null); // null | 'new' | zona object para editar

  const canManage = hasRole('admin', 'root');
  const canDelete = hasRole('root');

  const cargar = useCallback(() => {
    fetchZonas(token, page, pageSize)
      .then((res) => {
        setZonas(res.data);
        setTotal(res.total);
      })
      .catch((err) => toast.error(err.message || 'No se pudieron cargar las zonas'));
  }, [token, page, pageSize, toast]);

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setPage(1);
  };

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleDelete = async (zona) => {
    if (!window.confirm(`¿Eliminar la zona "${zona.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteZona(zona.id, token);
      toast.success('Zona eliminada correctamente.');
      cargar();
    } catch (err) {
      toast.error(err.message || 'No se pudo eliminar la zona');
    }
  };

  return (
    <>
      <PageHeader title="Zonas" subtitle="Zonas de estacionamiento del sistema">
        {canManage && (
          <Button variant="primary" icon={IconPlus} onClick={() => setModal('new')}>
            Nueva zona
          </Button>
        )}
      </PageHeader>

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
                    <td className="px-4 py-3 text-sm text-slate-600">{toEnumLabel(z.type, TIPO_ZONA_LABELS)}</td>
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
                    <td className="space-x-2 px-4 py-3 text-right text-sm">
                      {canManage && (
                        <Button variant="secondary" size="sm" icon={IconEdit} onClick={() => setModal(z)}>
                          Editar
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="danger" size="sm" icon={IconTrash} onClick={() => handleDelete(z)}>
                          Eliminar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />
        </div>
      )}

      {modal && (
        <ZoneFormModal zona={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSaved={cargar} />
      )}
    </>
  );
};

export default ZonasPage;
