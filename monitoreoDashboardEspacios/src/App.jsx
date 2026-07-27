import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './components/LoginPage.jsx';
import RegisterPage from './components/RegisterPage.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import EspaciosPage from './pages/EspaciosPage.jsx';
import ZonasPage from './pages/ZonasPage.jsx';
import VehiculosPage from './pages/VehiculosPage.jsx';
import AsignacionesPage from './pages/AsignacionesPage.jsx';
import TicketsPage from './pages/TicketsPage.jsx';
import UsuariosPage from './pages/UsuariosPage.jsx';
import RolesPage from './pages/RolesPage.jsx';
import AuditoriaPage from './pages/AuditoriaPage.jsx';
import { useAuth } from './context/AuthContext.jsx';

// Segunda capa además de ocultar el link en el Sidebar: sin esto, cualquier
// usuario autenticado podía llegar a /usuarios, /roles o /auditoria tecleando
// la URL directamente, aunque no tuviera el permiso.
const RequirePermission = ({ permission, children }) => {
  const { hasPermission } = useAuth();
  return hasPermission(permission) ? children : <Navigate to="/espacios" replace />;
};

function App() {
  const { isAuthenticated } = useAuth();
  const [showRegister, setShowRegister] = useState(false);

  if (!isAuthenticated) {
    return showRegister ? (
      <RegisterPage onDone={() => setShowRegister(false)} />
    ) : (
      <LoginPage onRegisterClick={() => setShowRegister(true)} />
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route index element={<Navigate to="/espacios" replace />} />
          <Route path="espacios" element={<EspaciosPage />} />
          <Route path="zonas" element={<ZonasPage />} />
          <Route path="vehiculos" element={<VehiculosPage />} />
          <Route path="asignaciones" element={<AsignacionesPage />} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route
            path="usuarios"
            element={
              <RequirePermission permission="gestionar_usuarios">
                <UsuariosPage />
              </RequirePermission>
            }
          />
          <Route
            path="roles"
            element={
              <RequirePermission permission="gestionar_roles">
                <RolesPage />
              </RequirePermission>
            }
          />
          <Route
            path="auditoria"
            element={
              <RequirePermission permission="ver_auditoria">
                <AuditoriaPage />
              </RequirePermission>
            }
          />
          <Route path="*" element={<Navigate to="/espacios" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
