import { useState } from 'react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import { createRole, updateRole } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500';
const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500';

const RoleFormModal = ({ rol, onClose, onSaved }) => {
  const { token } = useAuth();
  const isEdit = !!rol;
  const [name, setName] = useState(rol?.name ?? '');
  const [description, setDescription] = useState(rol?.description ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const payload = { name, description: description || undefined };
    try {
      if (isEdit) {
        await updateRole(rol.id, payload, token);
      } else {
        await createRole(payload, token);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el rol');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Editar rol' : 'Nuevo rol'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelClass}>Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={50}
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" variant="primary" loading={loading} className="w-full">
          {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear rol'}
        </Button>
      </form>
    </Modal>
  );
};

export default RoleFormModal;
