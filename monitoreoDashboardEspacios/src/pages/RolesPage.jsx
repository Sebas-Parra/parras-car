import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import Button from '../components/Button.jsx';
import RoleFormModal from '../components/RoleFormModal.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { useConfirm } from '../components/ConfirmModal.jsx';
import { fetchRoles, fetchPermissions, deleteRole } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { IconPlus, IconEdit, IconTrash } from '../components/icons.jsx';

const RolesPage = () => {
  const { token, hasRole } = useAuth();
  const toast = useToast();
  const { confirm, confirmModal } = useConfirm();
  const [roles, setRoles] = useState(null);
  const [permisos, setPermisos] = useState([]);
  const [modal, setModal] = useState(null); // null | 'new' | rol object para editar

  const canDelete = hasRole('root');

  const cargar = useCallback(() => {
    fetchRoles(token)
      .then(setRoles)
      .catch((err) => toast.error(err.message || 'No se pudieron cargar los roles'));
  }, [token, toast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    fetchPermissions(token)
      .then(setPermisos)
      .catch((err) => toast.error(err.message || 'No se pudieron cargar los permisos'));
  }, [token, toast]);

  const handleDelete = async (rol) => {
    const ok = await confirm(`¿Eliminar el rol "${rol.name}"? Esta acción no se puede deshacer.`, { danger: true });
    if (!ok) return;
    try {
      await deleteRole(rol.id, token);
      toast.success('Rol eliminado correctamente.');
      cargar();
    } catch (err) {
      toast.error(err.message || 'No se pudo eliminar el rol');
    }
  };

  return (
    <>
      <PageHeader title="Roles" subtitle="Roles disponibles en el sistema">
        <Button variant="primary" icon={IconPlus} onClick={() => setModal('new')}>
          Nuevo rol
        </Button>
      </PageHeader>

      {roles === null ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
          Cargando roles...
        </div>
      ) : roles.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
          No hay roles creados todavía.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Nombre', 'Descripción', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roles.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{r.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{r.description || '--'}</td>
                    <td className="px-4 py-3 text-right text-sm">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="secondary" size="sm" icon={IconEdit} onClick={() => setModal(r)}>
                          Editar
                        </Button>
                        {canDelete && (
                          <Button variant="danger" size="sm" icon={IconTrash} onClick={() => handleDelete(r)}>
                            Eliminar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <RoleFormModal
          role={modal === 'new' ? null : modal}
          permisos={permisos}
          onClose={() => setModal(null)}
          onSaved={cargar}
        />
      )}
      {confirmModal}
    </>
  );
};

export default RolesPage;
