import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import SearchSelect from '../components/SearchSelect.jsx';
import Pagination from '../components/Pagination.jsx';
import Button from '../components/Button.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { useConfirm } from '../components/ConfirmModal.jsx';
import { IconPlus, IconCheck, IconX } from '../components/icons.jsx';
import {
  fetchTickets,
  fetchEspacios,
  fetchVehiculos,
  fetchTicketsActivos,
  createTicket,
  payTicket,
  cancelTicket,
  ESTADO_TICKET_LABELS,
  TIPO_ESPACIO_LABELS,
  TIPO_VEHICULO_LABELS,
  TIPO_ZONA_LABELS,
  getAvailableTicketSpaces,
  toEnumLabel,
} from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500';
const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500';

const ESTADO_TICKET_STYLES = {
  ACTIVO: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  PAGADO: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  ANULADO: 'bg-slate-100 text-slate-600 ring-slate-500/10',
};

const NewTicketModal = ({ onClose, onCreated, token }) => {
  const toast = useToast();
  const [espacios, setEspacios] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [idEspacio, setIdEspacio] = useState('');
  const [placa, setPlaca] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoadingOptions(true);
    Promise.all([fetchEspacios(), fetchVehiculos(token), fetchTicketsActivos(token)])
      .then(([spaces, vehiclesResponse, activeTickets]) => {
        setEspacios(getAvailableTicketSpaces(spaces ?? [], activeTickets ?? []));
        setVehiculos(vehiclesResponse.data);
      })
      .catch((err) => toast.error(err.message || 'No se pudieron cargar las opciones del ticket'))
      .finally(() => setLoadingOptions(false));
  }, [token, toast]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!idEspacio) {
      toast.warning('Seleccioná un espacio');
      return;
    }
    if (!placa) {
      toast.warning('Seleccioná una placa');
      return;
    }
    setLoading(true);
    try {
      await createTicket({ idEspacio, placa: placa.toUpperCase() }, token);
      toast.success('Ticket creado correctamente.');
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.message || 'No se pudo crear el ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Nuevo ticket" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelClass}>Espacio</label>
          <SearchSelect
            options={espacios}
            value={idEspacio}
            onChange={setIdEspacio}
            getLabel={(e) => `${e.nombre} — ${e.nombreZona} (${toEnumLabel(e.tipo, TIPO_ESPACIO_LABELS)})`}
            placeholder={loadingOptions ? 'Cargando espacios...' : 'Buscar espacio disponible...'}
          />
          {!loadingOptions && espacios.length === 0 && (
            <p className="mt-1 text-xs text-slate-500">No hay espacios disponibles para crear un ticket.</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Placa</label>
          {vehiculos.length > 0 ? (
            <SearchSelect
              options={vehiculos}
              value={placa}
              onChange={setPlaca}
              getId={(v) => v.plate}
              getLabel={(v) => `${v.plate} — ${v.brand} ${v.model}`}
              placeholder="Buscar placa..."
            />
          ) : (
            <input value={placa} onChange={(e) => setPlaca(e.target.value)} required className={inputClass} />
          )}
        </div>
        <Button type="submit" variant="primary" loading={loading} className="w-full">
          {loading ? 'Creando...' : 'Crear ticket'}
        </Button>
      </form>
    </Modal>
  );
};

const TicketsPage = () => {
  const { token, hasRole } = useAuth();
  const toast = useToast();
  const { confirm, confirmModal } = useConfirm();
  const [tickets, setTickets] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showNew, setShowNew] = useState(false);

  const canOperar = hasRole('admin', 'root', 'recaudador');

  const cargar = useCallback(() => {
    fetchTickets(token, page, pageSize)
      .then((res) => {
        setTickets(res.data);
        setTotal(res.total);
      })
      .catch((err) => toast.error(err.message || 'No se pudieron cargar los tickets'));
  }, [token, page, pageSize, toast]);

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setPage(1);
  };

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handlePagar = async (id) => {
    try {
      await payTicket(id, token);
      toast.success('Ticket pagado correctamente.');
      cargar();
    } catch (err) {
      toast.error(err.message || 'No se pudo pagar el ticket');
    }
  };

  const handleAnular = async (id) => {
    const ok = await confirm('¿Anular este ticket?', { danger: true });
    if (!ok) return;
    try {
      await cancelTicket(id, token);
      toast.success('Ticket anulado correctamente.');
      cargar();
    } catch (err) {
      toast.error(err.message || 'No se pudo anular el ticket');
    }
  };

  return (
    <>
      <PageHeader title="Tickets" subtitle="Tickets de estacionamiento emitidos">
        {canOperar && (
          <Button variant="primary" icon={IconPlus} onClick={() => setShowNew(true)}>
            Nuevo ticket
          </Button>
        )}
      </PageHeader>

      {tickets === null ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
          Cargando tickets...
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
          No hay tickets emitidos todavía.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Código', 'Placa', 'Espacio', 'Ingreso', 'Tarifa/h', 'Recaudado', 'Estado', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{t.codigo}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {t.placa}
                      {t.tipoVehiculo && (
                        <span className="ml-2 text-xs text-slate-400">{toEnumLabel(t.tipoVehiculo, TIPO_VEHICULO_LABELS)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {t.codigoEspacio}
                      {(t.tipoEspacio || t.tipoZona) && (
                        <span className="ml-2 text-xs text-slate-400">
                          {[
                            t.tipoEspacio ? toEnumLabel(t.tipoEspacio, TIPO_ESPACIO_LABELS) : null,
                            t.tipoZona ? toEnumLabel(t.tipoZona, TIPO_ZONA_LABELS) : null,
                          ]
                            .filter(Boolean)
                            .join(' / ')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {new Date(t.fechaHoraIngreso).toLocaleString('es-ES', { hour12: false })}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{t.tarifaHora}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{t.valorRecaudado}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          ESTADO_TICKET_STYLES[t.estado] ?? 'bg-slate-100 text-slate-600 ring-slate-500/10'
                        }`}
                      >
                        {toEnumLabel(t.estado, ESTADO_TICKET_LABELS)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <div className="flex flex-wrap justify-end gap-2">
                        {canOperar && t.estado === 'ACTIVO' && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={IconCheck}
                              className="!border-emerald-300 !text-emerald-700 hover:!bg-emerald-50"
                              onClick={() => handlePagar(t.id)}
                            >
                              Pagar
                            </Button>
                            <Button variant="danger" size="sm" icon={IconX} onClick={() => handleAnular(t.id)}>
                              Anular
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      )}

      {showNew && <NewTicketModal token={token} onClose={() => setShowNew(false)} onCreated={cargar} />}
      {confirmModal}
    </>
  );
};

export default TicketsPage;
