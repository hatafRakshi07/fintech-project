// utils/log.ts
/** Simple log helper that prefixes output with an app name.
 * In production you may replace this with a structured logger (winston, pino, etc.).
 */
export function log(appName: string, ...args: any[]) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${appName}]`, ...args);
}
