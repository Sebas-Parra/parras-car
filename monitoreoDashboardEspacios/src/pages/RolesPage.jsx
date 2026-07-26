import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import Button from '../components/Button.jsx';
import RoleFormModal from '../components/RoleFormModal.jsx';
import { fetchRoles, deleteRole } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { IconPlus, IconEdit, IconTrash } from '../components/icons.jsx';

const RolesPage = () => {
  const { token, hasRole } = useAuth();
  const [roles, setRoles] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // null | 'new' | rol object para editar

  const canDelete = hasRole('root');

  const cargar = useCallback(() => {
    fetchRoles(token)
      .then(setRoles)
      .catch((err) => setError(err.message || 'No se pudieron cargar los roles'));
  }, [token]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleDelete = async (rol) => {
    if (!window.confirm(`¿Eliminar el rol "${rol.name}"? Esta acción no se puede deshacer.`)) return;
    setError('');
    try {
      await deleteRole(rol.id, token);
      cargar();
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el rol');
    }
  };

  return (
    <>
      <PageHeader title="Roles" subtitle="Roles disponibles en el sistema">
        <Button variant="primary" icon={IconPlus} onClick={() => setModal('new')}>
          Nuevo rol
        </Button>
      </PageHeader>

      {error && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{error}</span>
          <Button variant="link" size="none" onClick={() => setError('')}>
            Cerrar
          </Button>
        </div>
      )}

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
                    <td className="space-x-2 px-4 py-3 text-right text-sm">
                      <Button variant="secondary" size="sm" icon={IconEdit} onClick={() => setModal(r)}>
                        Editar
                      </Button>
                      {canDelete && (
                        <Button variant="danger" size="sm" icon={IconTrash} onClick={() => handleDelete(r)}>
                          Eliminar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <RoleFormModal rol={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSaved={cargar} />
      )}
    </>
  );
};

export default RolesPage;
