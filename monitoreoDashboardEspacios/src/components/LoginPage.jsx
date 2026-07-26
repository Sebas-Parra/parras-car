import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import Button from "./Button.jsx";
import logo from "../assets/logo.webp";

const LoginPage = ({ onRegisterClick }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src={logo}
            alt="Parras Car"
            className="-mb-4 h-36 w-auto object-contain"
          />
          <p className="text-xl font-semibold text-slate-900">Parras Car</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="w-full"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          ¿No tienes cuenta?{" "}
          <button
            type="button"
            onClick={onRegisterClick}
            className="font-medium text-slate-900 underline underline-offset-2 hover:text-slate-700"
          >
            Crear cuenta
          </button>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
