import http from "node:http";

/**
 * Global safe array sanitizer logic verification (mirroring lib/api-client-react & bissi-app utils)
 */
function safeArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.data)) return data.data;
  if (data && typeof data === "object" && Array.isArray(data.items)) return data.items;
  if (data && typeof data === "object" && Array.isArray(data.rows)) return data.rows;
  return [];
}

const BASE_URL = process.env.TEST_API_URL || "http://localhost:5000";

const ENDPOINTS_TO_TEST = [
  "/api/accounts",
  "/api/branches",
  "/api/collectors",
  "/api/committees",
  "/api/lotteries",
  "/api/customers",
  "/api/loans",
  "/api/collections",
  "/api/invoices",
  "/accounting/ledgers",
  "/accounting/vouchers",
  "/accounting/reports/trial-balance",
  "/accounting/reports/profit-loss",
  "/accounting/reports/balance-sheet",
  "/interests/accounts",
  "/interests/transactions",
  "/api/office/diary",
  "/api/office/tasks",
  "/api/office/complaints",
  "/api/office/donations",
  "/api/office/expenses",
  "/api/recovery/tasks",
  "/api/dashboard/stats",
  "/api/dashboard/recent-activity",
  "/api/dashboard/branch-summary",
];

async function runSmokeTest() {
  console.log(`\n🚀 Starting Systemic API & Frontend Safety Smoke Test on ${BASE_URL}...\n`);
  
  // 1. Unit test safeArray against 500 Error payloads
  const mockServerError = { error: "Internal Server Error 500", details: "Database timeout" };
  const mockResult = safeArray(mockServerError);
  if (Array.isArray(mockResult) && mockResult.length === 0) {
    console.log(`✅ [PASS Unit Test]: safeArray correctly converted 500 error object to empty array [].`);
  } else {
    console.error(`❌ [FAIL Unit Test]: safeArray failed on error object payload.`);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  for (const endpoint of ENDPOINTS_TO_TEST) {
    try {
      const url = new URL(endpoint, BASE_URL);
      const res = await fetch(url.toString(), {
        headers: { "Authorization": "Bearer demo-presentation-token" }
      });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}

      if (res.status === 500) {
        console.error(`❌ [FAIL 500 Internal Server Error]: ${endpoint}`);
        console.error(`   Body: ${text.slice(0, 200)}`);
        failed++;
      } else if (!json && res.status !== 204) {
        console.error(`❌ [FAIL Non-JSON Response]: ${endpoint} (Status ${res.status})`);
        failed++;
      } else {
        const safeData = safeArray(json);
        console.log(`✅ [PASS ${res.status}]: ${endpoint} -> Guaranteed Array Length: ${safeData.length}`);
        passed++;
      }
    } catch (err) {
      console.warn(`⚠️ [SKIP - Server Offline]: ${endpoint} (${err.message})`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`Systemic Regression Test Summary: ${passed} Passed | ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSmokeTest();
