/**
 * Smoke test for the logout / token-blocklist flow (issues C-2 and M-2).
 *
 * Usage:
 *   npx tsx scripts/test-logout.ts <admin-password>
 *   TEST_ADMIN_PASSWORD=xxx npx tsx scripts/test-logout.ts
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
    "  Pass it as an argument:        npx tsx scripts/test-logout.ts <password>\n" +
    "  Or set an env var:             TEST_ADMIN_PASSWORD=xxx npx tsx scripts/test-logout.ts",
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
  console.log(`\n${BOLD}Logout / token-blocklist smoke test${RESET}`);
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

  // Step 2 — Authenticated request succeeds before logout
  console.log("\nStep 2: Authenticated request before logout");
  const beforeRes = await request("GET", "/api/admin/dashboard-summary", { token });

  if (beforeRes.status === 200) {
    pass(`GET /api/admin/dashboard-summary → 200 (token is valid)`);
  } else {
    fail(
      `GET /api/admin/dashboard-summary — expected 200, got ${beforeRes.status}`,
      JSON.stringify(beforeRes.body, null, 2),
    );
  }

  // Step 3 — Logout
  console.log("\nStep 3: Logout");
  const logoutRes = await request("POST", "/api/auth/logout", { token });

  if (logoutRes.status === 200) {
    pass(`POST /api/auth/logout → 200`);
  } else {
    fail(
      `POST /api/auth/logout — expected 200, got ${logoutRes.status}`,
      JSON.stringify(logoutRes.body, null, 2),
    );
  }

  // Step 4 — Same token is now rejected
  console.log("\nStep 4: Revoked token is rejected");
  const afterRes = await request("GET", "/api/admin/dashboard-summary", { token });

  if (afterRes.status === 401) {
    const msg = (afterRes.body as { message?: string })?.message ?? "";
    pass(`GET /api/admin/dashboard-summary → 401 (token revoked)`);
    if (msg) console.log(`         message: "${msg}"`);
  } else {
    fail(
      `GET /api/admin/dashboard-summary — expected 401, got ${afterRes.status}`,
      JSON.stringify(afterRes.body, null, 2),
    );
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
