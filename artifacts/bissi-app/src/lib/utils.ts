import { twMerge } from 'tailwind-merge';
import { clsx, type ClassValue } from 'clsx';
import { useMemo } from 'react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Robust, universal array sanitizer for React components.
 * Safely extracts arrays from raw API responses, paginated objects ({ data: [...] }), or nullish values.
 * Guarantees a non-null Array is returned, preventing 'TypeError: .map is not a function' crashes.
 */
export function safeArray<T>(data: unknown): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as T[];
  if (Array.isArray((data as any)?.data)) return (data as any).data as T[];
  if (Array.isArray((data as any)?.items)) return (data as any).items as T[];
  if (Array.isArray((data as any)?.rows)) return (data as any).rows as T[];
  return [];
}

/**
 * Global safe list hook / helper as requested by system spec.
 */
export function useSafeList<T>(data: unknown): T[] {
  return safeArray<T>(data);
}

/**
 * React hook wrapper around safeArray for memoized performance.
 */
export function useSafeArray<T>(data: unknown): T[] {
  return useMemo(() => safeArray<T>(data), [data]);
}
