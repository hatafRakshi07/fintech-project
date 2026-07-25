/**
 * Universal safe array helper for Collector App.
 * Guarantees a non-null Array is returned for component rendering.
 */
export function safeArray<T>(data: unknown): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as any).data)) {
    return (data as any).data as T[];
  }
  if (data && typeof data === "object" && Array.isArray((data as any).items)) {
    return (data as any).items as T[];
  }
  if (data && typeof data === "object" && Array.isArray((data as any).rows)) {
    return (data as any).rows as T[];
  }
  return [];
}

export function useSafeList<T>(data: unknown): T[] {
  return safeArray<T>(data);
}
