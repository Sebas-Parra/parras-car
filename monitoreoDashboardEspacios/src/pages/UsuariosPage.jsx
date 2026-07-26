import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import RegisterUserModal from '../components/RegisterUserModal.jsx';
import RolesModal from '../components/RolesModal.jsx';
import Button from '../components/Button.jsx';
import { IconPlus, IconKey, IconTrash, IconCheck } from '../components/icons.jsx';
import { fetchUsers, fetchRoles, activateUser, deactivateUser } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const UsuariosPage = () => {
  const { token } = useAuth();
  const [usuarios, setUsuarios] = useState(null);
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [rolesModalUser, setRolesModalUser] = useState(null);

  const cargar = useCallback(() => {
    fetchUsers(token)
      .then(setUsuarios)
      .catch((err) => setError(err.message || 'No se pudieron cargar los usuarios'));
    fetchRoles(token).then(setRoles).catch(() => {});
  }, [token]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleToggleActive = async (u) => {
    setError('');
    try {
      if (u.active) {
        await deactivateUser(u.id_person, token);
      } else {
        await activateUser(u.id_person, token);
      }
      cargar();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el usuario');
    }
  };

  return (
    <>
      <PageHeader title="Usuarios" subtitle="Cuentas registradas en el sistema">
        <Button variant="primary" icon={IconPlus} onClick={() => setShowRegister(true)}>
          Nuevo usuario
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
                        {u.roles.map((r) => (
                          <span
                            key={r.id}
                            className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                          >
                            {r.name}
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
        </div>
      )}

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
    </>
  );
};

export default UsuariosPage;
