import 'zod';

declare module 'zod' {
  export function looseObject<T extends import('zod').ZodRawShape>(shape: T): import('zod').ZodObject<T, "passthrough">;
}
