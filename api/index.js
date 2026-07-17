// Vercel serverless function entry point
// Imports the compiled Express app and exports it as a handler

// Dynamic import to ensure the module system works correctly on Vercel
let appHandler;

async function getApp() {
  if (!appHandler) {
    const mod = await import('../artifacts/api-server/dist/index.mjs');
    appHandler = mod.default;
  }
  return appHandler;
}

export default async function handler(req, res) {
  const app = await getApp();
  return app(req, res);
}
