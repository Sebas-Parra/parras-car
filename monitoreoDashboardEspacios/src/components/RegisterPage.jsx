import { useState } from "react";
import { registerPerson } from "../api.js";
import { getCreatedUsername } from "../registerResponse.js";
import { getPhoneValidationError, normalizeOptionalPhone } from "../validation.js";
import Button from "./Button.jsx";
import { useToast } from "./ToastProvider.jsx";
import logo from "../assets/logo.webp";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";
const labelClass =
  "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500";

const RegisterPage = ({ onDone }) => {
  const toast = useToast();
  const [cedula, setCedula] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [createdUsername, setCreatedUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const phoneError = getPhoneValidationError(phone);
    if (phoneError) {
      toast.warning(phoneError);
      return;
    }
    setLoading(true);
    try {
      const createdPerson = await registerPerson({
        cedula,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: normalizeOptionalPhone(phone),
        password,
      });
      const username = getCreatedUsername(createdPerson);
      setCreatedUsername(username);
      setSuccess(true);
      toast.success(username ? `Cuenta creada. Tu usuario es ${username}.` : "Cuenta creada correctamente, ya puedes iniciar sesión.");
    } catch (err) {
      toast.error(err.message || "No se pudo crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUsername = async () => {
    if (!createdUsername) return;
    try {
      await navigator.clipboard.writeText(createdUsername);
      toast.success("Usuario copiado.");
    } catch {
      toast.info("Selecciona el usuario y cópialo manualmente.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src={logo}
            alt="Parras Car"
            className="-mb-4 h-36 w-auto object-contain"
          />
          <p className="text-xl font-semibold text-slate-900">Parras Car</p>
          <p className="text-sm text-slate-500">Crear cuenta</p>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-emerald-700">
              Cuenta creada correctamente. Guarda tu nombre de usuario para iniciar sesión.
            </p>
            {createdUsername && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Tu usuario</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <code className="min-w-0 flex-1 select-all break-all rounded-md bg-white px-3 py-2 text-base font-semibold text-slate-900 ring-1 ring-slate-200">
                    {createdUsername}
                  </code>
                  <Button variant="secondary" size="sm" onClick={handleCopyUsername}>
                    Copiar
                  </Button>
                </div>
              </div>
            )}
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
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej: 0991234567"
                    pattern="[\d\s+\-()]*"
                    title="Solo números, espacios y los caracteres: + - ( )"
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
