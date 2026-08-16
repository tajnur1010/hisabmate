const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/** Convert ASCII digits in a string to Bengali digits. */
export function toBengaliDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

export interface MoneyFormatOptions {
  currency?: string;
  bengaliNumerals?: boolean;
  /** Show a leading + / − sign. */
  signed?: boolean;
  /** Hide the currency symbol. */
  noSymbol?: boolean;
}

/**
 * Format a money amount using the South-Asian grouping (lakh/crore),
 * e.g. 4875000 → "48,75,000". Always renders a clean magnitude; direction
 * is expressed via `signed` or by the caller's colour choice.
 */
export function formatMoney(amount: number, opts: MoneyFormatOptions = {}): string {
  const { currency = '৳', bengaliNumerals = false, signed = false, noSymbol = false } = opts;
  const negative = amount < 0;
  const abs = Math.abs(Math.round((amount + Number.EPSILON) * 100) / 100);

  const [intPart, decPart] = abs.toFixed(abs % 1 === 0 ? 0 : 2).split('.');
  const grouped = groupIndianStyle(intPart);
  let body = decPart ? `${grouped}.${decPart}` : grouped;
  if (bengaliNumerals) body = toBengaliDigits(body);

  const sign = negative ? '−' : signed ? '+' : '';
  const symbol = noSymbol ? '' : currency;
  return `${sign}${symbol}${body}`;
}

/** Indian/Bangladeshi digit grouping: last 3 digits, then groups of 2. */
function groupIndianStyle(intStr: string): string {
  if (intStr.length <= 3) return intStr;
  const last3 = intStr.slice(-3);
  const rest = intStr.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
}

/** Compact form for chart axes and tight spaces: 48,750 → 48.7k, 4800000 → 48L. */
export function formatCompact(amount: number, bengaliNumerals = false): string {
  const abs = Math.abs(amount);
  let out: string;
  if (abs >= 1_00_00_000) out = `${(amount / 1_00_00_000).toFixed(1)}Cr`;
  else if (abs >= 1_00_000) out = `${(amount / 1_00_000).toFixed(1)}L`;
  else if (abs >= 1_000) out = `${(amount / 1_000).toFixed(1)}k`;
  else out = String(Math.round(amount));
  out = out.replace('.0', '');
  return bengaliNumerals ? toBengaliDigits(out) : out;
}

/** Parse a free-text amount (supports Bengali digits) into a number. */
export function parseAmount(input: string): number | null {
  const normalized = input
    .replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
    .replace(/[^0-9.]/g, '');
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
