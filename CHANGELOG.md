# CHANGELOG

All notable changes to the BJOC Backend will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project does not yet follow Semantic Versioning — entries are grouped by working session / branch.

---

## [Unreleased] — Branch: `security-fixes-peter`

**Session date:** April 13, 2026
**Author:** Peter (Joshua Jose Peter U. Bee)
**Branch:** `security-fixes-peter`
**Context:** Comprehensive security audit performed on `Backend-BJOC` using Claude Code static analysis. Audit identified 26 findings across CRITICAL, HIGH, MEDIUM, and LOW severities. This session resolves the surface-level issues that affect admin experience, system stability, and core security posture. Remaining findings are documented as deferred work in the paper's Scope and Limitations section.

### Security

#### `feat(security): add helmet middleware for security headers` — Audit L-1
- **Commit:** `7817cb1`
- **File:** `src/app.ts`
- **Problem:** Express server returned no security headers — missing CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, etc. Vulnerable to clickjacking, MIME-sniffing, XSS via injected content.
- **Fix:** Installed `helmet` and registered `app.use(helmet())` as the first middleware. Defaults are sensible for our setup; HSTS is intentionally omitted by helmet on non-HTTPS origins to avoid breaking localhost development.
- **Verify:** Open browser DevTools → Network tab → any request to `localhost:5000` → Response Headers → confirm `Content-Security-Policy`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`, etc.
- **Related:** `app.disable("x-powered-by")` is now redundant with helmet's `hidePoweredBy`. Left in place — harmless.

#### `fix(security): npm audit fix - patch dependency CVEs` — Audit H-1, H-2
- **Commit:** `abcdf2d`
- **File:** `package-lock.json`
- **Problem:**
  - `drizzle-orm < 0.45.2` — SQL injection via improperly escaped identifiers (GHSA-gpj5-g38j-94v9).
  - `path-to-regexp 8.0.0–8.3.0` (transitively via Express) — ReDoS vulnerability (GHSA-j3q9-mxjg-w52f).
- **Fix:** `npm audit fix` — 26 packages upgraded to patched versions. No breaking changes.
- **Remaining:** 4 moderate vulnerabilities in `drizzle-kit` (dev-only, via legacy `esbuild`). NOT patched because the fix is a breaking major version bump on a dev dependency that never runs in production. Documented as deferred.

#### `fix(security): remove NODE_ENV leak from /health endpoint` — Audit H-6
- **Commit:** `8849332`
- **File:** `src/modules/health/health.service.ts`
- **Problem:** `/health` returned `environment: NODE_ENV` to unauthenticated callers. Aids reconnaissance.
- **Fix:** Removed the `environment` field and the unused `appEnv` import. Endpoint still returns `{status, timestamp}`.

#### `feat(auth): add logout endpoint with JWT blocklist for revocation` — Audit C-2, M-2, M-1
- **Commit:** `95ccc3e`
- **Files changed:**
  - **NEW** `src/library/token-blocklist.ts` — LRU-cached JTI blocklist (max 10,000 entries, per-entry TTL = remaining token lifetime).
  - `src/library/jwt.ts` — `signAccessToken` now generates a `jti` via `crypto.randomUUID()`. `verifyAccessToken` now pins `algorithms: ["HS256"]` (also closes M-1).
  - `src/modules/auth/auth.types.ts` — `AuthenticatedUser` now exposes `jti` and `exp`.
  - `src/middleware/auth.middleware.ts` — Checks `isBlocklisted(jti)` after signature verify. If revoked → 401 `"Token has been revoked"`.
  - `src/modules/auth/auth.controller.ts` — New `authLogout` handler reads `jti` and `exp` from `req.authUser` and calls `addToBlocklist`.
  - `src/modules/auth/auth.routes.ts` — `POST /api/auth/logout` registered with `authenticateRequest` middleware.
  - `src/modules/users/users.service.ts` — JSDoc note added on `usersSuspendUser` documenting that token revocation on suspension is a known limitation.
  - **NEW** `scripts/test-logout.ts` — End-to-end smoke test: login → authenticated request → logout → confirm same token now returns 401.
- **Problem:** JWTs had a 7-day expiry with no revocation mechanism. No `/logout` endpoint existed. A stolen or otherwise unwanted token could not be killed without rotating `JWT_SECRET` (which logs out everyone).
- **Fix:** Pragmatic in-memory blocklist using LRU cache. Each token now carries a unique `jti`. Logout adds `jti` to the blocklist for the remaining token lifetime. Auth middleware checks the blocklist on every request.
- **Verify:**
  ```
  npx tsx scripts/test-logout.ts <admin-password>
  ```
  All 4 checks should pass.
- **Known limitations (documented as future work):**
  - Blocklist is in-memory → backend restart drops revocations until tokens naturally expire. Production should use Redis.
  - User suspension does not bulk-revoke that user's existing tokens (no per-user token registry to enumerate). Logout is the primary revocation path.

---

### Performance

#### `perf(operations): fetch single trip on end/cancel/emergency instead of full history` — Audit DB-3
- **Commit:** `24610a0`
- **File:** `src/modules/operations/operations.service.ts`
- **Problem:** `operationsEndTrip`, `operationsReportDriverEmergency`, `operationsCancelTrip`, and the private `findEmergencyHistoryTripByClientActionId` all called `operationsListTripHistory()` (an unbounded query over ALL completed/cancelled trips), then `.find()`'d for the one trip just modified.
- **Fix:** Added a private helper `operationsGetTripById(tripId)` that fetches a single trip row by primary key with the same projection and shape as `mapTripRows` produces. All four call sites refactored to use it. Return shape unchanged — `T | null` instead of `T[].find()` — same object structure.
- **Impact:** Per-call complexity reduced from O(n) over trip history to O(1) indexed lookup. Eliminates a slowdown that grows with dataset size.
- **Caller impact:** None — `trips.service.ts` and `driver.service.ts` callers return the value as-is. No frontend changes needed.
- **Flagged but not fixed (out of scope):** `operationsStartTrip` uses an analogous `operationsListActiveTrips().find()` pattern. Logged as a future cleanup candidate.

#### `fix(security): bound route stop cache with lru-cache` — Audit M-6 (partial)
- **Commit:** `d3ecc81`
- **File:** `src/modules/drivers/driver.service.ts`
- **Problem:** Module-level `Map` cache for tracking route stops had TTL bookkeeping but no maximum size. Over time, with one entry per route ID, memory grew without bound.
- **Fix:** Replaced with `LRUCache` (`max: 1000`, `ttl: ROUTE_STOP_CACHE_TTL_MS`). Manual `expiresAt` bookkeeping removed — `lru-cache` handles TTL natively, and `.get()` returns `undefined` for expired entries.
- **Audit note:** The audit also flagged `src/modules/system-settings/system-settings.service.ts` line 30 under M-6. Verified false positive: that line is a single nullable cached record, not a per-key Map. No leak risk. No change made.

---

### Operations Correctness

#### `fix(drivers): lock trip row with SELECT FOR UPDATE on occupancy update` — Audit M-4
- **Commit:** `00ff82b`
- **File:** `src/modules/drivers/driver.service.ts` (function: `driverSyncPassengerOccupancy`)
- **Problem:** Read-check-write race condition. The SELECT (with status / vehicleId / capacity validation) happened *outside* the transaction; the UPDATE happened inside its own transaction with no row lock. Concurrent occupancy updates could interleave — both reading the same starting state, both passing validation, both writing — losing updates or producing inconsistent counts.
- **Fix:** Wrapped the entire flow (SELECT, validation, UPDATE, lifecycle sync) in a single `db.transaction`. First statement inside the transaction is `sql\`select id from trips where id = ${tripId} for update\`` — acquires an exclusive row lock for the transaction's duration. Pattern copied from `lockScheduledTripForBooking` in `routes.service.ts:559` for consistency.
- **Result:** Concurrent updates against the same trip serialize at the lock — only one read-check-write cycle can be in flight per trip at a time.
- **Public API:** Unchanged. Callers and frontend unaffected.
- **Flagged but not fixed (out of scope):** `driverTrackTripLocation` (around line 1012) reads trip status then upserts a `vehicleLocations` row outside a locking transaction. Practical risk is low because `vehicleLocations` is keyed by vehicle, but worth a follow-up review if GPS update frequency is high.

---

### Reliability / Observability

#### `fix(security): add DB ping to /health for real readiness check` — Audit L-3
- **Commit:** `8f0c161`
- **Files:**
  - `src/modules/health/health.service.ts`
  - `src/modules/health/health.controller.ts`
- **Problem:** `/health` always returned `{status: "ok"}` even if the database connection was broken. Not a real liveness/readiness check.
- **Fix:** Service is now `async` and runs `SELECT 1` against the DB pool with a 2.5s timeout via `Promise.race`. On success: returns `{status: "ok", database: "connected", timestamp}`. On failure: throws `ServiceUnavailableError` (already in the codebase) → existing error middleware maps to HTTP 503 with structured body. Controller updated to async and forwards errors to `next` for middleware handling.
- **Verify:** `GET http://localhost:5000/api/health` → `{success: true, data: {status: "ok", database: "connected", timestamp: ...}}`.

---

## How to apply this branch

```bash
# Get this branch locally
git fetch origin
git checkout security-fixes-peter
npm install   # picks up new helmet + lru-cache deps and patched versions

# Run the auth fix smoke test
npm run dev
# (in another terminal)
npx tsx scripts/test-logout.ts <admin-password>
```

When ready to merge:
1. Branch is already pushed to `origin/security-fixes-peter`.
2. Open a Pull Request: <https://github.com/BJOC-Project/Backend-BJOC/pull/new/security-fixes-peter>
3. Karl + Felix review.
4. Merge to `main`.

---

## Summary of audit findings

| Resolved this session | Deferred (documented in paper Scope/Limitations) |
|---|---|
| H-1, H-2 (dependency CVEs) | C-1 credential rotation (out-of-band — Supabase password, service role key, Gmail app password, Geoapify key all in git history) |
| H-6 (NODE_ENV leak) | C-3 (service role key used globally — bypasses RLS) |
| L-3 (health DB ping) | C-4 (no rate limiting) |
| M-6 (driver cache) | C-5 (OTP brute-force protection) |
| C-2, M-2, M-1 (logout + JWT revocation + algorithm pin) | H-3 (activity log search pagination) |
| DB-3 (trip lookup) | H-4 (profile photo validation) |
| L-1 (helmet) | H-5 (SSL cert verification in production) |
| M-4 (occupancy row lock) | H-7 (seed credentials) |
| | M-3 (driver/admin route ordering) |
| | M-5 (stack trace exposure outside production) |
| | L-2 (5MB JSON body limit) |
| | L-4 (no unhandledRejection / uncaughtException handlers) |
| | L-5 (no request timeout) |
| | L-6 (env validation runs after pool init) |
| | DB-1 (no RLS policies in schema) |
| | DB-2 (operationsStartTrip / operationsEndTrip TOCTOU) |

**Resolved:** 10 audit findings.
**Deferred:** 16 audit findings, framed as production-readiness work and future research recommendations.

---

## Notes for future entries in this CHANGELOG

When you finish a working session, add a new section at the top under `## [Unreleased]` (or under a tagged version once we start versioning). Use these subsections in this order, omitting any that don't apply:

- **Security** — anything that changes attack surface, auth, headers, secrets handling
- **Performance** — anything that changes runtime cost, query patterns, caching
- **Operations Correctness** — race conditions, locks, transactions, data integrity
- **Reliability / Observability** — health checks, error handling, logging, monitoring
- **Features** — new functionality
- **Bug Fixes** — bugs that aren't security or correctness
- **Refactoring** — non-behavior-changing code changes
- **Documentation** — docs and comments

For each entry: commit hash, files touched, problem, fix, verification command, anything deliberately left undone.
