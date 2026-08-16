/** Validation helpers returning an i18n error key, or null when valid. */

export const MAX_AMOUNT = 100_00_00_000; // 100 crore guard rail

export function validateAmount(value: unknown): string | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (value === '' || value === null || value === undefined || Number.isNaN(n)) {
    return 'validation.amountRequired';
  }
  if (!Number.isFinite(n)) return 'validation.amountInvalid';
  if (n <= 0) return 'validation.amountPositive';
  if (n > MAX_AMOUNT) return 'validation.amountTooLarge';
  return null;
}

export function validateName(value: string): string | null {
  if (!value || value.trim().length < 2) return 'validation.nameRequired';
  if (value.trim().length > 80) return 'validation.nameTooLong';
  return null;
}

export function validatePhone(value: string | null | undefined): string | null {
  if (!value) return null; // optional
  const digits = value.replace(/[^0-9+]/g, '');
  if (digits.length < 6 || digits.length > 15) return 'validation.phoneInvalid';
  return null;
}

export function validateEmail(value: string): string | null {
  if (!value) return 'validation.emailRequired';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'validation.emailInvalid';
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return 'validation.passwordRequired';
  if (value.length < 6) return 'validation.passwordShort';
  return null;
}
