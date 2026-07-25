import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
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
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? 'Creando...' : 'Crear ticket'}
        </button>
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
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="whitespace-nowrap rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            + Nuevo ticket
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
                          <button type="button" onClick={() => handlePagar(t.id)} className="font-medium text-emerald-600 hover:text-emerald-800">
                            Pagar
                          </button>
                          <button type="button" onClick={() => handleAnular(t.id)} className="font-medium text-red-600 hover:text-red-800">
                            Anular
                          </button>
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
