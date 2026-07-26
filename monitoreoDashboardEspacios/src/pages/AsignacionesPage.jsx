import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import SearchSelect from '../components/SearchSelect.jsx';
import Pagination from '../components/Pagination.jsx';
import Button from '../components/Button.jsx';
import { IconTrash, IconPlus, IconArrowsRightLeft } from '../components/icons.jsx';
import {
  fetchFlota,
  fetchVehiculos,
  fetchUsers,
  createAsignacion,
  deleteAsignacion,
  transferAsignacion,
  fetchAsignacionesAudit,
} from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500';
const getUserId = (u) => u.id_person;
const getUserLabel = (u) => u.username;
const getVehiculoLabel = (v) => `${v.plate} — ${v.brand} ${v.model}`;

const AsignacionesPage = () => {
  const { token, userId, hasRole } = useAuth();
  const canManage = hasRole('admin', 'root');

  const [usuarioObjetivo, setUsuarioObjetivo] = useState(userId);
  const [flota, setFlota] = useState(null);
  const [vehiculos, setVehiculos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [vehiculoAAsignar, setVehiculoAAsignar] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [transferVehiculo, setTransferVehiculo] = useState('');
  const [transferDesde, setTransferDesde] = useState('');
  const [transferHacia, setTransferHacia] = useState('');
  const [auditoria, setAuditoria] = useState(null);
  const [auditoriaTotal, setAuditoriaTotal] = useState(0);
  const [auditoriaPage, setAuditoriaPage] = useState(1);
  const [auditoriaPageSize, setAuditoriaPageSize] = useState(10);

  const handleAuditoriaPageSizeChange = (size) => {
    setAuditoriaPageSize(size);
    setAuditoriaPage(1);
  };

  const flotaOptions = [
    { id_person: userId, username: 'Yo mismo' },
    ...usuarios.filter((u) => u.id_person !== userId),
  ];

  const cargarFlota = useCallback(
    (uid) => {
      if (!uid) return;
      fetchFlota(uid, token)
        .then(setFlota)
        .catch((err) => {
          setFlota({ vehicles: [] });
          if (err.message && !err.message.includes('404')) setError(err.message);
        });
    },
    [token],
  );

  useEffect(() => {
    cargarFlota(usuarioObjetivo);
  }, [usuarioObjetivo, cargarFlota]);

  useEffect(() => {
    fetchVehiculos(token).then((res) => setVehiculos(res.data)).catch((err) => {
      console.error('Error cargando vehículos:', err);
    });
    if (canManage) {
      fetchUsers(token)
        .then((res) => setUsuarios(res.data))
        .catch((err) => {
          console.error('Error cargando usuarios:', err);
          setError(`Error al cargar usuarios: ${err.message}`);
        });
    }
  }, [token, canManage]);

  useEffect(() => {
    if (!canManage) return;
    fetchAsignacionesAudit(token, auditoriaPage, auditoriaPageSize)
      .then((res) => {
        setAuditoria(res.data);
        setAuditoriaTotal(res.total);
      })
      .catch((err) => {
        console.error('Error cargando auditoría:', err);
      });
  }, [token, canManage, auditoriaPage, auditoriaPageSize]);

  const handleAsignar = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    try {
      await createAsignacion({ user_id: usuarioObjetivo, vehicle_id: vehiculoAAsignar }, token);
      setInfo('Vehículo asignado correctamente.');
      setVehiculoAAsignar('');
      cargarFlota(usuarioObjetivo);
    } catch (err) {
      setError(err.message || 'No se pudo asignar el vehículo');
    }
  };

  const handleQuitar = async (vehicleId) => {
    if (!window.confirm('¿Quitar este vehículo de la flota?')) return;
    setError('');
    try {
      await deleteAsignacion(usuarioObjetivo, vehicleId, token);
      cargarFlota(usuarioObjetivo);
    } catch (err) {
      setError(err.message || 'No se pudo quitar la asignación');
    }
  };

  const handleTransferir = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    try {
      await transferAsignacion(transferVehiculo, { from_user_id: transferDesde, to_user_id: transferHacia }, token);
      setInfo('Vehículo transferido correctamente.');
      setTransferVehiculo('');
      setTransferDesde('');
      setTransferHacia('');
      cargarFlota(usuarioObjetivo);
    } catch (err) {
      setError(err.message || 'No se pudo transferir el vehículo');
    }
  };

  return (
    <>
      <PageHeader title="Asignaciones" subtitle="Vehículos asignados a cada usuario" />

      {error && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{error}</span>
          <Button variant="link" size="none" onClick={() => setError('')}>
            Cerrar
          </Button>
        </div>
      )}
      {info && (
        <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          <span>{info}</span>
          <Button variant="link" size="none" onClick={() => setInfo('')}>
            Cerrar
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex-1">
                <label className={labelClass}>Flota de</label>
                {canManage ? (
                  <SearchSelect
                    options={flotaOptions}
                    value={usuarioObjetivo}
                    onChange={setUsuarioObjetivo}
                    getId={getUserId}
                    getLabel={getUserLabel}
                    placeholder="Buscar usuario..."
                  />
                ) : (
                  <p className="text-sm text-slate-600">Mi flota</p>
                )}
              </div>
            </div>

            {flota === null ? (
              <p className="text-sm text-slate-500">Cargando flota...</p>
            ) : flota.vehicles?.length === 0 ? (
              <p className="text-sm text-slate-500">Este usuario no tiene vehículos asignados.</p>
            ) : (
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr>
                    {['Placa', 'Marca', 'Modelo', 'Tipo', ''].map((h) => (
                      <th key={h} className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {flota.vehicles?.map((v) => (
                    <tr key={v.id}>
                      <td className="px-2 py-2 text-sm font-medium text-slate-900">{v.plate}</td>
                      <td className="px-2 py-2 text-sm text-slate-600">{v.brand}</td>
                      <td className="px-2 py-2 text-sm text-slate-600">{v.model}</td>
                      <td className="px-2 py-2 text-sm text-slate-600">{v.tipo}</td>
                      <td className="px-2 py-2 text-right text-sm">
                        {canManage && (
                          <Button variant="danger" size="sm" icon={IconTrash} onClick={() => handleQuitar(v.id)}>
                            Quitar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <form onSubmit={handleAsignar} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Asignar vehículo</h2>
            <div>
              <label className={labelClass}>Vehículo</label>
              <SearchSelect
                options={vehiculos}
                value={vehiculoAAsignar}
                onChange={setVehiculoAAsignar}
                getLabel={getVehiculoLabel}
                placeholder="Buscar vehículo..."
              />
            </div>
            <Button type="submit" variant="primary" icon={IconPlus} disabled={!vehiculoAAsignar}>
              Asignar
            </Button>
          </form>

          {canManage && (
            <form onSubmit={handleTransferir} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Transferir vehículo entre usuarios</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>Vehículo</label>
                  <SearchSelect
                    options={vehiculos}
                    value={transferVehiculo}
                    onChange={setTransferVehiculo}
                    getLabel={(v) => v.plate}
                    placeholder="Buscar vehículo..."
                  />
                </div>
                <div>
                  <label className={labelClass}>Desde</label>
                  <SearchSelect
                    options={usuarios}
                    value={transferDesde}
                    onChange={setTransferDesde}
                    getId={getUserId}
                    getLabel={getUserLabel}
                    placeholder="Buscar usuario..."
                  />
                </div>
                <div>
                  <label className={labelClass}>Hacia</label>
                  <SearchSelect
                    options={usuarios}
                    value={transferHacia}
                    onChange={setTransferHacia}
                    getId={getUserId}
                    getLabel={getUserLabel}
                    placeholder="Buscar usuario..."
                  />
                </div>
              </div>
              <Button type="submit" variant="primary" icon={IconArrowsRightLeft}>
                Transferir
              </Button>
            </form>
          )}
        </div>

        {canManage && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Auditoría de asignaciones</h2>
            {auditoria === null ? (
              <p className="text-sm text-slate-500">Cargando...</p>
            ) : auditoria.length === 0 ? (
              <p className="text-sm text-slate-500">Sin eventos registrados.</p>
            ) : (
              <>
                <ul className="space-y-2 text-xs text-slate-600">
                  {auditoria.map((a) => (
                    <li key={a.id} className="border-b border-slate-100 pb-2">
                      <span className="font-medium text-slate-900">{a.action}</span> ·{' '}
                      {new Date(a.timestamp).toLocaleString('es-ES', { hour12: false })}
                    </li>
                  ))}
                </ul>
                <Pagination
                  page={auditoriaPage}
                  pageSize={auditoriaPageSize}
                  total={auditoriaTotal}
                  onPageChange={setAuditoriaPage}
                  onPageSizeChange={handleAuditoriaPageSizeChange}
                />
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default AsignacionesPage;
