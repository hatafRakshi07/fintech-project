import type { Response } from "express";

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

/**
 * Universal list response helper for Express API routes.
 * GUARANTEES that any list endpoint returns a clean JSON array (never undefined or null).
 * In case of any internal error, returns an empty array [] to prevent frontend .map() crashes.
 */
export function sendListResponse<T>(res: Response, data: T[] | null | undefined, statusCode = 200): void {
  const safeData = Array.isArray(data) ? data : [];
  res.status(statusCode).json(safeData);
}

export function sendErrorListResponse(res: Response, errorMessage: string, statusCode = 500): void {
  console.error(`[API LIST ERROR]: ${errorMessage}`);
  res.status(statusCode).json([]);
}
