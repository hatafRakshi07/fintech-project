/* Local type declarations for multer — guarantees builds on Render
   even if @types/multer is not resolved from the registry. */

declare module "multer" {
  import { RequestHandler } from "express";

  interface File {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    destination: string;
    filename: string;
    path: string;
    buffer: Buffer;
  }

  interface Options {
    dest?: string;
    storage?: any;
    limits?: any;
    fileFilter?: any;
  }

  interface Instance {
    single(fieldname: string): RequestHandler;
    array(fieldname: string, maxCount?: number): RequestHandler;
    fields(fields: Array<{ name: string; maxCount?: number }>): RequestHandler;
    none(): RequestHandler;
    any(): RequestHandler;
  }

  function multer(options?: Options): Instance;
  export = multer;
}

declare global {
  namespace Express {
    interface Request {
      file?: import("multer").File;
      files?: import("multer").File[] | Record<string, import("multer").File[]>;
    }
  }
}
