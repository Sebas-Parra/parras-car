import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';
import Button from '../components/Button.jsx';
import { fetchAuditoria } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const AuditoriaPage = () => {
  const { token } = useAuth();
  const [eventos, setEventos] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAuditoria(token, page, pageSize)
      .then((res) => {
        setEventos(res.data);
        setTotal(res.total);
      })
      .catch((err) => setError(err.message || 'No se pudo cargar la auditoría'));
  }, [token, page, pageSize]);

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setPage(1);
  };

  return (
    <>
      <PageHeader title="Auditoría" subtitle="Eventos registrados por todos los microservicios" />

      {error && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{error}</span>
          <Button variant="link" size="none" onClick={() => setError('')}>
            Cerrar
          </Button>
        </div>
      )}

      {eventos === null ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
          Cargando eventos...
        </div>
      ) : eventos.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
          No hay eventos registrados todavía.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Fecha', 'Servicio', 'Acción', 'Entidad', 'Usuario', 'Rol', 'IP'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {eventos.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {new Date(ev.timestamp).toLocaleString('es-ES', { hour12: false })}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{ev.service}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{ev.action}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{ev.entity}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{ev.username}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{ev.rol}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{ev.ip}</td>
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
    </>
  );
};

export default AuditoriaPage;
