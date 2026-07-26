import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import Button from '../components/Button.jsx';
import { IconPlus, IconCheck, IconX } from '../components/icons.jsx';
import { fetchTickets, fetchEspacios, fetchVehiculos, createTicket, payTicket, cancelTicket } from '../api.js';
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
  const [espacios, setEspacios] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [idEspacio, setIdEspacio] = useState('');
  const [placa, setPlaca] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEspacios().then((data) => setEspacios(data ?? []));
    fetchVehiculos(token)
      .then((data) => {
        setVehiculos(data);
        if (data.length > 0) setPlaca(data[0].plate);
      })
      .catch(() => {});
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createTicket({ idEspacio, placa: placa.toUpperCase() }, token);
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo crear el ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Nuevo ticket" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelClass}>Espacio</label>
          <select value={idEspacio} onChange={(e) => setIdEspacio(e.target.value)} required className={inputClass}>
            <option value="">Seleccioná un espacio...</option>
            {espacios.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre} — {e.nombreZona}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Placa</label>
          {vehiculos.length > 0 ? (
            <select value={placa} onChange={(e) => setPlaca(e.target.value)} required className={inputClass}>
              {vehiculos.map((v) => (
                <option key={v.id} value={v.plate}>
                  {v.plate} — {v.brand} {v.model}
                </option>
              ))}
            </select>
          ) : (
            <input value={placa} onChange={(e) => setPlaca(e.target.value)} required className={inputClass} />
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" variant="primary" loading={loading} className="w-full">
          {loading ? 'Creando...' : 'Crear ticket'}
        </Button>
      </form>
    </Modal>
  );
};

const TicketsPage = () => {
  const { token, hasRole } = useAuth();
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);

  const canOperar = hasRole('admin', 'root', 'recaudador');

  const cargar = useCallback(() => {
    fetchTickets(token)
      .then(setTickets)
      .catch((err) => setError(err.message || 'No se pudieron cargar los tickets'));
  }, [token]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handlePagar = async (id) => {
    setError('');
    try {
      await payTicket(id, token);
      cargar();
    } catch (err) {
      setError(err.message || 'No se pudo pagar el ticket');
    }
  };

  const handleAnular = async (id) => {
    if (!window.confirm('¿Anular este ticket?')) return;
    setError('');
    try {
      await cancelTicket(id, token);
      cargar();
    } catch (err) {
      setError(err.message || 'No se pudo anular el ticket');
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

      {error && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{error}</span>
          <Button variant="link" size="none" onClick={() => setError('')}>
            Cerrar
          </Button>
        </div>
      )}

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
                    <td className="px-4 py-3 text-sm text-slate-600">{t.placa}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{t.codigoEspacio}</td>
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
                        {t.estado}
                      </span>
                    </td>
                    <td className="space-x-3 px-4 py-3 text-right text-sm">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNew && <NewTicketModal token={token} onClose={() => setShowNew(false)} onCreated={cargar} />}
    </>
  );
};

export default TicketsPage;
