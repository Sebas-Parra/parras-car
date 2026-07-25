import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './components/LoginPage.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import EspaciosPage from './pages/EspaciosPage.jsx';
import ZonasPage from './pages/ZonasPage.jsx';
import VehiculosPage from './pages/VehiculosPage.jsx';
import AsignacionesPage from './pages/AsignacionesPage.jsx';
import TicketsPage from './pages/TicketsPage.jsx';
import UsuariosPage from './pages/UsuariosPage.jsx';
import AuditoriaPage from './pages/AuditoriaPage.jsx';
import { useAuth } from './context/AuthContext.jsx';

function App() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
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
          <Route path="usuarios" element={<UsuariosPage />} />
          <Route path="auditoria" element={<AuditoriaPage />} />
          <Route path="*" element={<Navigate to="/espacios" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
