import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import RegisterUserModal from '../components/RegisterUserModal.jsx';
import RolesModal from '../components/RolesModal.jsx';
import RoleFormModal from '../components/RoleFormModal.jsx';
import Pagination from '../components/Pagination.jsx';
import Button from '../components/Button.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { IconPlus, IconKey, IconTrash, IconCheck } from '../components/icons.jsx';
import { fetchUsers, fetchRoles, fetchPermissions, activateUser, deactivateUser, ROLE_LABELS, toEnumLabel } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const UsuariosPage = () => {
  const { token } = useAuth();
  const toast = useToast();
  const [usuarios, setUsuarios] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [roles, setRoles] = useState([]);
  const [permisos, setPermisos] = useState([]);
  const [showRegister, setShowRegister] = useState(false);
  const [rolesModalUser, setRolesModalUser] = useState(null);
  const [roleFormModal, setRoleFormModal] = useState(null); // null | 'new' | role object

  const cargar = useCallback(() => {
    fetchUsers(token, page, pageSize)
      .then((res) => {
        setUsuarios(res.data);
        setTotal(res.total);
      })
      .catch((err) => toast.error(err.message || 'No se pudieron cargar los usuarios'));
    fetchRoles(token).then(setRoles).catch((err) => toast.error(err.message || 'No se pudieron cargar los roles'));
    fetchPermissions(token).then(setPermisos).catch((err) => toast.error(err.message || 'No se pudieron cargar los permisos'));
  }, [token, page, pageSize, toast]);

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setPage(1);
  };

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleToggleActive = async (u) => {
    try {
      if (u.active) {
        await deactivateUser(u.id_person, token);
        toast.success('Usuario desactivado correctamente.');
      } else {
        await activateUser(u.id_person, token);
        toast.success('Usuario activado correctamente.');
      }
      cargar();
    } catch (err) {
      toast.error(err.message || 'No se pudo actualizar el usuario');
    }
  };

  return (
    <>
      <PageHeader title="Usuarios" subtitle="Cuentas registradas en el sistema">
        <Button variant="primary" icon={IconPlus} onClick={() => setShowRegister(true)}>
          Nuevo usuario
        </Button>
      </PageHeader>

      {usuarios === null ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
          Cargando usuarios...
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Usuario', 'Roles', 'Estado', 'Último acceso', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usuarios.map((u) => (
                  <tr key={u.id_person} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{u.username}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <div className="flex flex-wrap gap-1">
                        {(u.roles ?? []).map((r) => (
                          <span
                            key={r.id}
                            className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                          >
                            {toEnumLabel(r.name, ROLE_LABELS)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          u.active
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                            : 'bg-slate-100 text-slate-600 ring-slate-500/10'
                        }`}
                      >
                        {u.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {u.last_login ? new Date(u.last_login).toLocaleString('es-ES', { hour12: false }) : '--'}
                    </td>
                    <td className="space-x-2 px-4 py-3 text-right text-sm">
                      <Button variant="secondary" size="sm" icon={IconKey} onClick={() => setRolesModalUser(u)}>
                        Roles
                      </Button>
                      {u.active ? (
                        <Button variant="danger" size="sm" icon={IconTrash} onClick={() => handleToggleActive(u)}>
                          Desactivar
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={IconCheck}
                          className="!border-emerald-300 !text-emerald-700 hover:!bg-emerald-50"
                          onClick={() => handleToggleActive(u)}
                        >
                          Activar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />
        </div>
      )}

      <PageHeader title="Roles" subtitle="Roles disponibles y sus permisos">
        <button
          type="button"
          onClick={() => setRoleFormModal('new')}
          className="whitespace-nowrap rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + Nuevo rol
        </button>
      </PageHeader>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {['Rol', 'Descripción', 'Permisos', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roles.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{toEnumLabel(r.name, ROLE_LABELS)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{r.description || '--'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    <div className="flex flex-wrap gap-1">
                      {(r.permissions ?? []).map((p) => (
                        <span
                          key={p.id}
                          className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                        >
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <button type="button" onClick={() => setRoleFormModal(r)} className="font-medium text-slate-600 hover:text-slate-900">
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showRegister && <RegisterUserModal onClose={() => setShowRegister(false)} onCreated={cargar} />}
      {rolesModalUser && (
        <RolesModal
          usuario={rolesModalUser}
          roles={roles}
          onClose={() => setRolesModalUser(null)}
          onSaved={() => {
            cargar();
            setRolesModalUser(null);
          }}
        />
      )}
      {roleFormModal && (
        <RoleFormModal
          role={roleFormModal === 'new' ? null : roleFormModal}
          permisos={permisos}
          onClose={() => setRoleFormModal(null)}
          onSaved={cargar}
        />
      )}
    </>
  );
};

export default UsuariosPage;
