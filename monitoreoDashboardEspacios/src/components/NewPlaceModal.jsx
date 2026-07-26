import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import SearchSelect from './SearchSelect.jsx';
import Button from './Button.jsx';
import { createEspacio, fetchZonas, TIPO_ESPACIO_OPTIONS, ESTADO_OPTIONS } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500';
const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500';

const NewPlaceModal = ({ onClose, onCreated }) => {
  const { token } = useAuth();
  const [zonas, setZonas] = useState([]);
  const [idZone, setIdZone] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState(TIPO_ESPACIO_OPTIONS[0]);
  const [status, setStatus] = useState('AVAILABLE');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingZonas, setLoadingZonas] = useState(true);

  useEffect(() => {
    fetchZonas(token)
      .then((res) => setZonas(res.data))
      .catch((err) => setError(err.message || 'No se pudieron cargar las zonas'))
      .finally(() => setLoadingZonas(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!idZone) {
      setError('Seleccioná una zona');
      return;
    }
    setLoading(true);
    try {
      await createEspacio({ idZone, description: description || undefined, type, status }, token);
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo crear el espacio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Nuevo espacio" onClose={onClose}>
      {loadingZonas ? (
        <p className="text-sm text-slate-500">Cargando zonas...</p>
      ) : zonas.length === 0 ? (
        <p className="text-sm text-slate-500">No hay zonas creadas todavía — creá una zona primero.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelClass}>Zona</label>
            <SearchSelect options={zonas} value={idZone} onChange={setIdZone} placeholder="Buscar zona..." />
          </div>
          <div>
            <label className={labelClass}>Descripción (opcional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={31}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Tipo</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
                {TIPO_ESPACIO_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Estado inicial</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
                {ESTADO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" variant="primary" loading={loading} className="w-full">
            {loading ? 'Creando...' : 'Crear espacio'}
          </Button>
        </form>
      )}
      {error && zonas.length === 0 && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Modal>
  );
};

export default NewPlaceModal;
