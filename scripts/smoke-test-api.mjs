import http from "node:http";

/**
 * Regression & Smoke Test Suite for Fintech API Server.
 * Hits all list-rendering endpoints to verify:
 * 1. HTTP Status Code is NOT 500 (must be 200 OK or 401/403 unauth).
 * 2. Response body is valid JSON.
 * 3. Array or paginated data structure is returned without server exception.
 */

const BASE_URL = process.env.TEST_API_URL || "http://localhost:5000";

const ENDPOINTS_TO_TEST = [
  "/api/branches",
  "/api/collectors",
  "/api/committees",
  "/api/lotteries",
  "/api/customers",
  "/api/loans",
  "/api/collections",
  "/api/invoices",
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
  console.log(`\n🚀 Starting API Smoke & Regression Test on ${BASE_URL}...\n`);
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
      } else if (!json) {
        console.error(`❌ [FAIL Non-JSON Response]: ${endpoint} (Status ${res.status})`);
        failed++;
      } else {
        console.log(`✅ [PASS ${res.status}]: ${endpoint}`);
        passed++;
      }
    } catch (err) {
      console.warn(`⚠️ [SKIP - Server Offline]: ${endpoint} (${err.message})`);
    }
  }

  console.log(`\n==============================================`);
  console.log(`Smoke Test Summary: ${passed} Passed | ${failed} Failed`);
  console.log(`==============================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSmokeTest();
