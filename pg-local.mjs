/**
 * Local PostgreSQL server using PGlite — no Docker required.
 * Runs on port 5432. Data persists in ./pglite-data/
 *
 * Start: node pg-local.mjs
 * Stop:  Ctrl+C
 */
import { PGlite } from "@electric-sql/pglite";

const DATA_DIR = "./pglite-data";
const PORT = 5432;

// PGlite server support
const { PGliteServer } = await import("@electric-sql/pglite/server").catch(() => null) ?? {};

if (!PGliteServer) {
  // Fallback: use the TCP server from pglite directly
  const net = await import("net");
  const pg = new PGlite(DATA_DIR);
  await pg.waitReady;
  console.log(`[PGlite] Database ready at ${DATA_DIR}`);
  
  // Simple TCP proxy that speaks PostgreSQL protocol
  const server = net.createServer(async (socket) => {
    socket.on("data", async (data) => {
      try {
        const result = await pg.execProtocolRaw(data);
        socket.write(result);
      } catch (e) {
        console.error("[PGlite] Error:", e.message);
      }
    });
    socket.on("error", () => {});
  });
  
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`[PGlite] PostgreSQL listening on 127.0.0.1:${PORT}`);
    console.log(`[PGlite] Connect with: postgresql://postgres@127.0.0.1:${PORT}/bissi_db`);
  });
} else {
  const pg = new PGlite(DATA_DIR);
  await pg.waitReady;
  const server = new PGliteServer(pg);
  await server.listen({ port: PORT, host: "127.0.0.1" });
  console.log(`[PGlite] PostgreSQL server listening on 127.0.0.1:${PORT}`);
  console.log(`[PGlite] Connect with: postgresql://postgres@127.0.0.1:${PORT}/bissi_db`);
}

process.on("SIGINT", () => { console.log("\n[PGlite] Shutting down..."); process.exit(0); });
