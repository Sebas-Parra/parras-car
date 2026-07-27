import { useState } from 'react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import { useToast } from './ToastProvider.jsx';
import { createRole, ROLE_LABELS, toEnumLabel, updateRole } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500';
const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500';

// Solo root puede otorgar la eliminación física de zonas/espacios.
const ROOT_ONLY_PERMISSIONS = new Set(['eliminar_zonas']);

const RoleFormModal = ({ role, permisos, onClose, onSaved }) => {
  const { token, hasRole } = useAuth();
  const toast = useToast();
  const isEdit = !!role;
  const isRoot = hasRole('root');
  const selectablePermisos = (permisos ?? []).filter((p) => isRoot || !ROOT_ONLY_PERMISSIONS.has(p.name));

  const defaultSelected = isEdit
    ? new Set((role.permissions ?? []).map((p) => p.id))
    : new Set((permisos ?? []).filter((p) => p.is_public).map((p) => p.id));

  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [selectedIds, setSelectedIds] = useState(defaultSelected);
  const [loading, setLoading] = useState(false);

  const togglePermission = (permId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { name, description: description || null, permission_ids: Array.from(selectedIds) };
      if (isEdit) {
        await updateRole(role.id, payload, token);
      } else {
        await createRole(payload, token);
      }
      toast.success(isEdit ? 'Rol actualizado correctamente.' : 'Rol creado correctamente.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'No se pudo guardar el rol');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={isEdit ? `Editar rol: ${toEnumLabel(role.name, ROLE_LABELS)}` : 'Nuevo rol'} onClose={onClose}>
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

        <div>
          <label className={labelClass}>Permisos</label>
          <p className="mb-2 text-xs text-slate-500">
            Los permisos públicos vienen marcados por defecto. Agregá o quitá los que necesites.
          </p>
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-2">
            {selectablePermisos.map((perm) => (
              <label key={perm.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={selectedIds.has(perm.id)}
                  onChange={() => togglePermission(perm.id)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="font-medium text-slate-900">{perm.name}</span>
                {perm.is_public && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                    público
                  </span>
                )}
                {perm.description && <span className="text-xs text-slate-500">— {perm.description}</span>}
              </label>
            ))}
          </div>
        </div>

        <Button type="submit" variant="primary" loading={loading} className="w-full">
          {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear rol'}
        </Button>
      </form>
    </Modal>
  );
};

export default RoleFormModal;
