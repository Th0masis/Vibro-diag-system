import { useState } from 'react';

export function useValidationState(validateField) {
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [liveValidation, setLiveValidation] = useState({});

  const onBlurField = (field, value, values) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const message = validateField(field, value, values);
    setErrors((prev) => ({ ...prev, [field]: message }));
    if (message) {
      setLiveValidation((prev) => ({ ...prev, [field]: true }));
    }
  };

  const onChangeField = (field, value, values) => {
    if (!liveValidation[field]) return;
    const message = validateField(field, value, values);
    setErrors((prev) => ({ ...prev, [field]: message }));
  };

  const validateForm = (fields, values) => {
    const nextErrors = {};
    fields.forEach((field) => {
      nextErrors[field] = validateField(field, values[field], values);
    });

    setErrors(nextErrors);
    setTouched((prev) => ({
      ...prev,
      ...fields.reduce((acc, field) => ({ ...acc, [field]: true }), {}),
    }));

    const failedFields = fields.filter((field) => nextErrors[field]);
    if (failedFields.length > 0) {
      setLiveValidation((prev) => ({
        ...prev,
        ...failedFields.reduce((acc, field) => ({ ...acc, [field]: true }), {}),
      }));
      return false;
    }

    return true;
  };

  const getInputClass = (field, value, opts = {}) => {
    const enabled = opts.enabled !== false;
    if (!enabled) return '';
    if (!touched[field]) return '';
    if (errors[field]) return 'form-input-error';

    const hasValue = value !== '' && value != null && String(value).trim() !== '';
    return hasValue ? 'form-input-success' : '';
  };

  const clearValidation = () => {
    setTouched({});
    setErrors({});
    setLiveValidation({});
  };

  return {
    touched,
    errors,
    liveValidation,
    onBlurField,
    onChangeField,
    validateForm,
    getInputClass,
    clearValidation,
    setErrors,
    setTouched,
  };
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}
