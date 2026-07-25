import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import Topbar from '../components/Topbar.jsx';

const DashboardLayout = () => (
  <div className="flex min-h-screen bg-slate-50">
    <Sidebar />
    <div className="flex min-w-0 flex-1 flex-col">
      <Topbar />
      <main className="flex-1 space-y-6 p-6">
        <Outlet />
      </main>
    </div>
  </div>
);

export default DashboardLayout;
