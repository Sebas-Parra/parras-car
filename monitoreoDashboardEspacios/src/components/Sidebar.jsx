import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import logo from "../assets/logo.webp";
import {
  IconLayers,
  IconMap,
  IconUsers,
  IconCar,
  IconClipboard,
  IconTicket,
  IconShield,
  IconKey,
} from "./icons.jsx";

const NAV_ITEMS = [
  { to: "/espacios", label: "Espacios", Icon: IconLayers },
  { to: "/zonas", label: "Zonas", Icon: IconMap },
  { to: "/vehiculos", label: "Vehículos", Icon: IconCar },
  { to: "/asignaciones", label: "Asignaciones", Icon: IconClipboard },
  { to: "/tickets", label: "Tickets", Icon: IconTicket },
  {
    to: "/usuarios",
    label: "Usuarios",
    Icon: IconUsers,
    permission: "gestionar_usuarios",
  },
  {
    to: "/roles",
    label: "Roles",
    Icon: IconKey,
    permission: "gestionar_roles",
  },
  {
    to: "/auditoria",
    label: "Auditoría",
    Icon: IconShield,
    permission: "ver_auditoria",
  },
];

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-slate-800 text-white"
      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
  }`;

const Sidebar = ({ open = false, onClose }) => {
  const { hasPermission } = useAuth();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col bg-slate-900 text-slate-100 transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col items-center border-b border-slate-800 px-6 py-5">
          <img
            src={logo}
            alt="Parras Car"
            className="-mb-4 h-20 w-20 shrink-0 object-contain"
          />
          <p className="whitespace-nowrap text-lg font-semibold tracking-wide text-white">
            Parras Car
          </p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.filter(
            (item) => !item.permission || hasPermission(item.permission),
          ).map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={linkClass} onClick={onClose}>
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 px-6 py-4 text-xs text-slate-500">
          v1.0.0
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
