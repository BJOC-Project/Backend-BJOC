/**
 * Smoke test for the paginated activity log endpoint (issue H-3).
 *
 * Usage:
 *   npx tsx scripts/test-activity-log-pagination.ts <admin-password>
 *   TEST_ADMIN_PASSWORD=xxx npx tsx scripts/test-activity-log-pagination.ts
 *
 * The script expects the server to be running locally.
 * Set API_URL to override (default: http://localhost:5000).
 */

import dotenv from "dotenv";

dotenv.config();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = process.env.API_URL ?? "http://localhost:5000";
const ADMIN_EMAIL = "admin@bjoc.com";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? process.argv[2];

if (!ADMIN_PASSWORD) {
  console.error(
    "Error: admin password is required.\n" +
    "  Pass it as an argument:        npx tsx scripts/test-activity-log-pagination.ts <password>\n" +
    "  Or set an env var:             TEST_ADMIN_PASSWORD=xxx npx tsx scripts/test-activity-log-pagination.ts",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

let passed = 0;
let failed = 0;

function pass(label: string) {
  console.log(`  ${GREEN}✓${RESET} ${label}`);
  passed++;
}

function fail(label: string, detail?: string) {
  console.error(`  ${RED}✗${RESET} ${label}`);
  if (detail) console.error(`    ${RED}${detail}${RESET}`);
  failed++;
}

async function request(
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Test steps
// ---------------------------------------------------------------------------

async function run() {
  console.log(`\n${BOLD}Activity log pagination smoke test${RESET}`);
  console.log(`Target: ${BASE_URL}\n`);

  // Step 1 — Login
  console.log("Step 1: Login as admin");
  const loginRes = await request("POST", "/api/auth/login", {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });

  if (loginRes.status !== 200) {
    fail(
      `POST /api/auth/login — expected 200, got ${loginRes.status}`,
      JSON.stringify(loginRes.body, null, 2),
    );
    console.log(`\n${RED}Cannot continue: login failed.${RESET}`);
    process.exit(1);
  }

  const token = (loginRes.body as { data: { accessToken: string } }).data.accessToken;

  if (!token) {
    fail("Login response missing data.accessToken");
    process.exit(1);
  }

  pass(`POST /api/auth/login → 200, token received`);

  // Step 2 — Fetch page 1 (limit=10, offset=0)
  console.log("\nStep 2: GET /api/activity-logs?limit=10&offset=0");
  const page1Res = await request("GET", "/api/activity-logs?limit=10&offset=0", { token });

  if (page1Res.status !== 200) {
    fail(
      `GET /api/activity-logs — expected 200, got ${page1Res.status}`,
      JSON.stringify(page1Res.body, null, 2),
    );
  } else {
    const data = (page1Res.body as { data: unknown }).data as { rows: unknown[]; total: number } | null;

    if (!data || typeof data !== "object") {
      fail("Response data is missing or not an object", JSON.stringify(page1Res.body, null, 2));
    } else if (!Array.isArray(data.rows)) {
      fail(`data.rows is not an array — got ${typeof data.rows}`, JSON.stringify(data, null, 2));
    } else if (typeof data.total !== "number") {
      fail(`data.total is not a number — got ${typeof data.total}`, JSON.stringify(data, null, 2));
    } else {
      pass(`GET /api/activity-logs → 200, shape { rows: Array(${data.rows.length}), total: ${data.total} }`);

      if (data.rows.length <= 10) {
        pass(`rows.length (${data.rows.length}) respects limit=10`);
      } else {
        fail(`rows.length (${data.rows.length}) exceeds limit=10`);
      }
    }
  }

  // Step 3 — Clamp limit > 200 should be rejected or clamped
  console.log("\nStep 3: GET /api/activity-logs?limit=999 (should be rejected by Zod max=200)");
  const clampRes = await request("GET", "/api/activity-logs?limit=999", { token });

  if (clampRes.status === 400) {
    pass(`GET /api/activity-logs?limit=999 → 400 (Zod rejected out-of-range limit)`);
  } else if (clampRes.status === 200) {
    const data = (clampRes.body as { data: unknown }).data as { rows: unknown[]; total: number } | null;
    if (data && Array.isArray(data.rows) && data.rows.length <= 200) {
      pass(`GET /api/activity-logs?limit=999 → 200, rows clamped to ≤200 (${data.rows.length})`);
    } else {
      fail(`GET /api/activity-logs?limit=999 → 200 but rows exceeds 200`, JSON.stringify(data, null, 2));
    }
  } else {
    fail(`GET /api/activity-logs?limit=999 — unexpected status ${clampRes.status}`);
  }

  // Step 4 — Search filter
  console.log("\nStep 4: GET /api/activity-logs?limit=10&search=user");
  const searchRes = await request("GET", "/api/activity-logs?limit=10&search=user", { token });

  if (searchRes.status === 200) {
    const data = (searchRes.body as { data: unknown }).data as { rows: unknown[]; total: number } | null;
    if (data && Array.isArray(data.rows) && typeof data.total === "number") {
      pass(`GET /api/activity-logs?search=user → 200, shape OK (${data.rows.length} rows, total ${data.total})`);
    } else {
      fail(`Search response has wrong shape`, JSON.stringify(data, null, 2));
    }
  } else {
    fail(`GET /api/activity-logs?search=user — expected 200, got ${searchRes.status}`);
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log(`\n${"─".repeat(40)}`);
  const all = passed + failed;
  if (failed === 0) {
    console.log(`${GREEN}${BOLD}All ${all} checks passed.${RESET}`);
  } else {
    console.log(`${GREEN}${passed} passed${RESET}  ${RED}${failed} failed${RESET}  (${all} total)`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(`\n${RED}Unexpected error:${RESET}`, err);
  process.exit(1);
});
