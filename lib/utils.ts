import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function safeParse<T>(value: string | null, defaultValue: T): T {
  if (!value) return defaultValue
  const trimmed = value.trim()
  if (trimmed === 'undefined' || trimmed === '') return defaultValue
  try {
    return JSON.parse(trimmed) as T
  } catch (e) {
    console.error('Failed to parse JSON', e)
    return defaultValue
  }
}

export function parseDateSafe(dateString: string | undefined | null): Date {
  if (!dateString) return new Date();
  
  const d = new Date(dateString);
  if (!isNaN(d.getTime())) return d;
  
  // fallback for Safari standard parsing failure (YYYY-MM-DD)
  const fallback = new Date(dateString.replace(/-/g, '/').replace(/T/g, ' '));
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

export function sortByNameAsc<T extends { name?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    (a?.name || '').trim().localeCompare((b?.name || '').trim(), undefined, {
      sensitivity: 'base',
      numeric: true,
    })
  );
}

/**
 * Enforces strict phone formatting: allows only digits (0-9) and a single leading '+'.
 * Completely disallows spaces and any other special characters.
 */
export function sanitizePhoneInput(value: string): string {
  if (!value) return '';
  const cleaned = value.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+')) {
    return '+' + cleaned.slice(1).replace(/\+/g, '');
  }
  return cleaned.replace(/\+/g, '');
}

/**
 * Validates that a phone number consists only of digits with an optional single leading '+'.
 */
export function isValidPhoneNumber(value: string): boolean {
  if (!value) return false;
  return /^\+?\d+$/.test(value);
}
