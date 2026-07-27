const PHONE_REGEX = /^\d+$/;

export const getPhoneValidationError = (phone) => {
  const value = phone.trim();
  if (!value) return '';
  if (!PHONE_REGEX.test(value)) {
    return 'El teléfono solo puede contener números';
  }
  return '';
};

export const normalizeOptionalPhone = (phone) => {
  const value = phone.trim();
  return value || undefined;
};
