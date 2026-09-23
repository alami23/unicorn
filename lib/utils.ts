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

