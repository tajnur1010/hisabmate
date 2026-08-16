import type { Language } from '@/types';
import { toBengaliDigits } from './money';

export function startOfDay(d: Date | string): Date {
  const date = typeof d === 'string' ? new Date(d) : new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(d: Date | string): Date {
  const date = typeof d === 'string' ? new Date(d) : new Date(d.getTime());
  date.setHours(23, 59, 59, 999);
  return date;
}

export function isSameDay(a: Date | string, b: Date | string): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function isToday(d: Date | string): boolean {
  return isSameDay(d, new Date());
}

export function addDays(d: Date | string, days: number): Date {
  const date = typeof d === 'string' ? new Date(d) : new Date(d.getTime());
  date.setDate(date.getDate() + days);
  return date;
}

/** Whole days from `from` until `to` (positive if `to` is later). */
export function daysBetween(from: Date | string, to: Date | string): number {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function monthKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const MONTHS: Record<Language, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  bn: ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্ট', 'অক্টো', 'নভে', 'ডিসে'],
};

function loc(n: number, lang: Language): string {
  return lang === 'bn' ? toBengaliDigits(n) : String(n);
}

/** e.g. "16 Aug 2026" / "১৬ আগস্ট ২০২৬". */
export function formatDate(d: Date | string, lang: Language = 'en'): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return `${loc(date.getDate(), lang)} ${MONTHS[lang][date.getMonth()]} ${loc(date.getFullYear(), lang)}`;
}

/** e.g. "3:05 PM" / "৩:০৫ PM". */
export function formatTime(d: Date | string, lang: Language = 'en'): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  let h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const time = `${h}:${m}`;
  return `${lang === 'bn' ? toBengaliDigits(time) : time} ${ampm}`;
}

export function formatDateTime(d: Date | string, lang: Language = 'en'): string {
  return `${formatDate(d, lang)}, ${formatTime(d, lang)}`;
}

/** Human relative day label: Today / Yesterday / date. */
export function relativeDay(d: Date | string, lang: Language = 'en'): string {
  const diff = daysBetween(d, new Date());
  if (diff === 0) return lang === 'bn' ? 'আজ' : 'Today';
  if (diff === 1) return lang === 'bn' ? 'গতকাল' : 'Yesterday';
  if (diff === -1) return lang === 'bn' ? 'আগামীকাল' : 'Tomorrow';
  return formatDate(d, lang);
}

export function toDateInputValue(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10);
}
