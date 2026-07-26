import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import VehicleFormModal from '../components/VehicleFormModal.jsx';
import Pagination from '../components/Pagination.jsx';
import Button from '../components/Button.jsx';
import { IconPlus, IconEdit, IconTrash, IconCheck } from '../components/icons.jsx';
import {
  fetchVehiculos,
  activateVehiculo,
  deleteVehiculo,
  fetchTicketsActivos,
  fetchAsignacionPorVehiculo,
  TIPO_VEHICULO_LABELS,
} from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const VehiculosPage = () => {
  const { token, hasRole } = useAuth();
  const [vehiculos, setVehiculos] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // null | 'new' | vehiculo object

  const canManage = hasRole('admin', 'root');

  const cargar = useCallback(() => {
    fetchVehiculos(token, page, pageSize)
      .then((res) => {
        setVehiculos(res.data);
        setTotal(res.total);
      })
      .catch((err) => setError(err.message || 'No se pudieron cargar los vehículos'));
  }, [token, page, pageSize]);

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setPage(1);
  };

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleDelete = async (v) => {
    setError('');
    try {
      const ticketsActivos = await fetchTicketsActivos(token);
      const ticketActivo = ticketsActivos.find((t) => t.idVehiculo === v.id);
      if (ticketActivo) {
        setError(
          `No se puede desactivar ${v.plate}: está ocupando un espacio ahora mismo (ticket ${ticketActivo.codigo}). Pagá o anulá ese ticket primero.`,
        );
        return;
      }

      const asignacion = await fetchAsignacionPorVehiculo(v.id, token);
      if (asignacion) {
        setError(`No se puede desactivar ${v.plate}: tiene un usuario asignado. Quitá la asignación primero desde Asignaciones.`);
        return;
      }

      if (!window.confirm(`¿Desactivar el vehículo ${v.plate}?`)) return;
      await deleteVehiculo(v.id, token);
      cargar();
    } catch (err) {
      setError(err.message || 'No se pudo desactivar el vehículo');
    }
  };

  const handleActivate = async (v) => {
    setError('');
    try {
      await activateVehiculo(v.id, token);
      cargar();
    } catch (err) {
      setError(err.message || 'No se pudo reactivar el vehículo');
    }
  };

  return (
    <>
      <PageHeader title="Vehículos" subtitle="Vehículos registrados en el sistema">
        <Button variant="primary" icon={IconPlus} onClick={() => setModal('new')}>
          Nuevo vehículo
        </Button>
      </PageHeader>

      {error && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{error}</span>
          <Button variant="link" size="none" onClick={() => setError('')}>
            Cerrar
          </Button>
        </div>
      )}

      {vehiculos === null ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
          Cargando vehículos...
        </div>
      ) : vehiculos.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
          No hay vehículos registrados todavía.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Placa', 'Tipo', 'Marca', 'Modelo', 'Año', 'Clasificación', 'Estado', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehiculos.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{v.plate}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{TIPO_VEHICULO_LABELS[v.tipo] ?? v.tipo}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{v.brand}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{v.model}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{v.year}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{v.clasification}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          v.active
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                            : 'bg-slate-100 text-slate-600 ring-slate-500/10'
                        }`}
                      >
                        {v.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="space-x-2 px-4 py-3 text-right text-sm">
                      {canManage && (
                        <Button variant="secondary" size="sm" icon={IconEdit} onClick={() => setModal(v)}>
                          Editar
                        </Button>
                      )}
                      {canManage && v.active && (
                        <Button variant="danger" size="sm" icon={IconTrash} onClick={() => handleDelete(v)}>
                          Desactivar
                        </Button>
                      )}
                      {canManage && !v.active && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={IconCheck}
                          className="!border-emerald-300 !text-emerald-700 hover:!bg-emerald-50"
                          onClick={() => handleActivate(v)}
                        >
                          Reactivar
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
        <VehicleFormModal vehiculo={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSaved={cargar} />
      )}
    </>
  );
};

export default VehiculosPage;
