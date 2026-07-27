import { useState } from 'react';
import Modal from './Modal.jsx';
import { useToast } from './ToastProvider.jsx';
import { assignRole, removeRole, ROLE_LABELS, toEnumLabel } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const RolesModal = ({ usuario, roles, onClose, onSaved }) => {
  const { token } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const assignedIds = new Set((usuario.roles ?? []).map((r) => r.id));

  const toggleRole = async (role) => {
    setLoading(true);
    try {
      if (assignedIds.has(role.id)) {
        await removeRole(usuario.id_person, role.id, token);
        toast.success('Rol quitado correctamente.');
      } else {
        await assignRole(usuario.id_person, role.id, token);
        toast.success('Rol asignado correctamente.');
      }
      onSaved();
    } catch (err) {
      toast.error(err.message || 'No se pudo actualizar el rol');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Roles de ${usuario.username}`} onClose={onClose}>
      <div className="space-y-2">
        {(roles ?? []).map((role) => (
          <label key={role.id} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={assignedIds.has(role.id)}
              disabled={loading}
              onChange={() => toggleRole(role)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="font-medium text-slate-900">{toEnumLabel(role.name, ROLE_LABELS)}</span>
            {role.description && <span className="text-xs text-slate-500">— {role.description}</span>}
          </label>
        ))}
      </div>
    </Modal>
  );
};

export default RolesModal;
