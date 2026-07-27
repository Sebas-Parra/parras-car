import { useState } from 'react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import { useToast } from './ToastProvider.jsx';
import { createZona, updateZona, TIPO_ZONA_LABELS, TIPO_ZONA_OPTIONS, toEnumLabel } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500';
const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500';

const ZoneFormModal = ({ zona, onClose, onSaved }) => {
  const { token } = useAuth();
  const toast = useToast();
  const isEdit = !!zona;
  const [name, setName] = useState(zona?.name ?? '');
  const [description, setDescription] = useState(zona?.description ?? '');
  const [capacity, setCapacity] = useState(zona?.capacity ?? 10);
  const [type, setType] = useState(zona?.type ?? TIPO_ZONA_OPTIONS[0]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { name, description: description || undefined, capacity: Number(capacity), type };
    try {
      if (isEdit) {
        await updateZona(zona.id, payload, token);
      } else {
        await createZona(payload, token);
      }
      toast.success(isEdit ? 'Zona actualizada correctamente.' : 'Zona creada correctamente.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'No se pudo guardar la zona');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Editar zona' : 'Nueva zona'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelClass}>Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={32}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Descripción (opcional)</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={255}
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Capacidad</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
              {TIPO_ZONA_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {toEnumLabel(t, TIPO_ZONA_LABELS)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button type="submit" variant="primary" loading={loading} className="w-full">
          {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear zona'}
        </Button>
      </form>
    </Modal>
  );
};

export default ZoneFormModal;
