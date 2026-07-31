import pg from "pg";
const { Pool } = pg;

const NEON_DEFAULT_URL = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb";

async function test() {
  let url = process.env.DATABASE_URL || NEON_DEFAULT_URL;
  if (url.includes(".neon.tech") && !url.includes("-pooler")) {
    url = url.replace(/([a-z0-9-]+)(\.[a-z0-9-]+\.aws\.neon\.tech)/i, "$1-pooler$2");
  }

  let hostname = "";
  try {
    const u = new URL(url);
    hostname = u.hostname;
    u.searchParams.delete("sslmode");
    u.searchParams.delete("ssl");

    if (u.hostname.includes(".neon.tech")) {
      const endpointId = u.hostname.split(".")[0];
      if (!u.searchParams.has("options") || !u.searchParams.get("options")?.includes("endpoint=")) {
        const existingOptions = u.searchParams.get("options");
        const newOptions = existingOptions
          ? `${existingOptions} endpoint=${endpointId}`
          : `endpoint=${endpointId}`;
        u.searchParams.set("options", newOptions);
      }
    }
    url = u.toString();
  } catch (e) {
    console.error("URL parse error", e);
  }

  console.log("Testing connection with URL:", url);

  const pool = new Pool({
    connectionString: url,
    max: 2,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false, ...(hostname ? { servername: hostname } : {}) },
  });

  try {
    const client = await pool.connect();
    console.log("Connected successfully!");
    const res = await client.query("SELECT 1 as num");
    console.log("Query result:", res.rows);
    client.release();
  } catch (err) {
    console.error("Connection error:", err);
  } finally {
    await pool.end();
  }
}

test();
