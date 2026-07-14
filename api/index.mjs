// Vercel Serverless Function entry point
// Re-exports the pre-built Express app from the esbuild bundle
import app from "../artifacts/api-server/dist/index.mjs";
export default app;
