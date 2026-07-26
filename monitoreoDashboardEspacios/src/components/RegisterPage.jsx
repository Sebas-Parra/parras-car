import { useState } from "react";
import { registerPerson } from "../api.js";
import Button from "./Button.jsx";
import logo from "../assets/logo.webp";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";
const labelClass =
  "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500";

const RegisterPage = ({ onDone }) => {
  const [cedula, setCedula] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await registerPerson({
        cedula,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || undefined,
        password,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message || "No se pudo crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img
            src={logo}
            alt="Parras Car"
            className="h-36 w-auto object-contain"
          />
          <p className="text-xl font-semibold text-slate-900">Parras Car</p>
          <p className="text-sm text-slate-500">Crear cuenta</p>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-emerald-700">
              Cuenta creada correctamente, ya puedes iniciar sesión.
            </p>
            <Button variant="primary" className="w-full" onClick={onDone}>
              Ir a iniciar sesión
            </Button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Cédula</label>
                  <input
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Teléfono (opcional)</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Nombres</label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Apellidos</label>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className={inputClass}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                type="submit"
                variant="primary"
                loading={loading}
                className="w-full"
              >
                {loading ? "Creando..." : "Crear cuenta"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-slate-500">
              ¿Ya tienes cuenta?{" "}
              <button
                type="button"
                onClick={onDone}
                className="font-medium text-slate-900 underline underline-offset-2 hover:text-slate-700"
              >
                Iniciar sesión
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default RegisterPage;
