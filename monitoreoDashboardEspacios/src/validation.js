// Debe coincidir con users/app/dto/person.py (_PHONE_REGEX) para que el
// frontend no rechace formatos que el backend sí acepta.
const PHONE_REGEX = /^[\d\s+\-()]+$/;

export const getPhoneValidationError = (phone) => {
  const value = phone.trim();
  if (!value) return '';
  if (!PHONE_REGEX.test(value)) {
    return 'El teléfono solo puede contener dígitos, espacios y los caracteres: + - ( )';
  }
  return '';
};

export const normalizeOptionalPhone = (phone) => {
  const value = phone.trim();
  return value || undefined;
};
