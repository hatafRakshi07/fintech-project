import * as zod from "zod";

if (!(zod as any).looseObject) {
  (zod as any).looseObject = <T extends zod.ZodRawShape>(shape: T) =>
    zod.object(shape).passthrough();
}

export * from "./generated/api";
export * from "./generated/types";
