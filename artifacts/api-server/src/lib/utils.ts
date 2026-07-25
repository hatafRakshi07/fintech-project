/**
 * Safely converts any Date instance, ISO string, timestamp, or nullish value
 * into a valid ISO string ("YYYY-MM-THH:mm:ss.sssZ").
 * Prevents TypeError crashes when DB drivers return strings or unexpected types.
 */
export function safeIso(d: any): string {
  if (!d) return new Date().toISOString();
  if (d instanceof Date) return d.toISOString();
  if (typeof d === "string") {
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }
  if (typeof d === "number") {
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }
  return new Date().toISOString();
}
