// Vercel Serverless Function entry point
// Re-exports the Express app built by esbuild
import app from "../dist/index.mjs";
export default app;
