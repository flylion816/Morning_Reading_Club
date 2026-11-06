## Implementation status update — 2026-10-12

The checklist below remains the full closure plan. Items stay unchecked until their stated acceptance evidence exists; this update distinguishes local implementation from production completion.

- **Local implementation complete, production acceptance pending:** 2.1–2.5; 3.1–3.5; 4.2–4.5; 5.2–5.4; 6.1, 6.2 (code/config only), 6.4–6.6. Related regression tests are present. Remaining gates include real Redis multi-worker behavior, production topology, real MySQL success-flow acceptance, external caller migration, and provider sandbox evidence.
- **Partially complete / evidence still required:** 1.6 (current configs/templates improved; full history/releases scan and repository-side secret-scanning controls not closed); 2.6 (local admin browser flow passed, simulated cross-worker/production store proof pending); 3.6–3.7 (local security tests exist, audit evidence completeness pending); 4.1 and 4.6 (caller inventory/migration and alert evidence); 5.1 and 5.5 (merchant protocol/sandbox callback verification); 6.3 and 6.7 (production listener/firewall review and operational alert setup).
- **External/production TODO:** 1.1–1.5; 5.6; 7.1, 7.3–7.6. These require repository, production, or merchant owners and cannot be closed by local tests.
- **Local test evidence:** backend 1077 unit and 126 integration tests pass; admin 295 tests, type-check, and build pass. Latest `npm ci` and `npm audit` report 0 vulnerabilities in backend/admin. Coverage is 69.4%, below the repository's 90% line/function/statement and 85% branch thresholds. Strict OpenSpec validation was not run because the CLI is unavailable; 7.2 remains open.
- **Safety boundary:** no database initialization/reset/restore was run; no production deployment or secret rotation was performed.

## 1. Emergency containment and credential rotation

- [ ] 1.1 Preserve dated hashes/visibility evidence for the public GitHub files and record repository audit-log coverage; restrict public repository access and review collaborators, deploy keys, forks, releases, tags, and automation access.
- [ ] 1.2 Search all reachable Git history, tags, release artifacts, tracked config examples, deploy scripts, and generated bundles for the confirmed production JWT, MySQL, Redis, and administrator bootstrap credential values. Keep values out of scan output and evidence artifacts.
- [ ] 1.3 Inventory every consumer of the shared MySQL/Redis and other confirmed public credentials. Agree the cutover window with users of any shared service credential before rotating it.
- [ ] 1.4 Issue new independent production user-access, admin-access, admin-refresh, and WebSocket signing keys. Update all active workers from the controlled secret source, restart every worker, verify the key fingerprint/config version without printing the value, and prove old tokens are rejected.
- [ ] 1.5 Rotate exposed MySQL, Redis, and administrator database-access/bootstrap credentials in consumer order. Prefer dedicated least-privilege service accounts where supported. Verify backup/sync workers and other affected products before revoking each old credential.
- [ ] 1.6 Remove production values/default fallbacks from `.env.prod`, `.env.docker`, `.backup/.env.production.backup.*`, `scripts/generate-env-production.js`, deploy scripts, docs, and every other discovered source/history. Replace examples with placeholders and enforce secret scanning on future commits.

## 2. Administrator identity, token purpose, and session revocation

- [ ] 2.1 Add focused regression tests in `backend/tests/unit/middleware/adminAuth.middleware.test.js` and `backend/tests/unit/utils/jwt.util.test.js` for a forged administrator payload, disabled/deleted account, changed role/tenant, wrong issuer/audience/purpose, expired token, missing key, and cross-purpose key reuse.
- [ ] 2.2 Implement explicit token purposes/issuer/audience, separate keys, bounded administrator-access lifetime, and fail-closed key validation in `backend/src/utils/jwt.js`, `backend/src/middleware/adminAuth.js`, `backend/src/middleware/auth.js`, and `backend/src/utils/config-validator.js`.
- [ ] 2.3 Add administrator session/version persistence and indexes to `backend/src/models/Admin.js` or a dedicated session model. Load the current administrator record on protected administrator requests and compare enabled status, role, tenant, session/version, and token claims before controller execution.
- [ ] 2.4 Rotate and revoke session version/refresh credentials on logout, password change/reset, disablement, role/tenant changes, and privileged administrator updates. Ensure `adminAuthMiddleware`, `requireRole`, and `requirePermission` use current server-side state.
- [ ] 2.5 Update `backend/src/controllers/admin.controller.js`, `backend/src/routes/admin.routes.js`, `admin/src/api.ts`, `admin/src/stores/auth.ts`, and login/profile flows for short access credentials plus a `Secure`, `HttpOnly`, `SameSite=Strict` refresh cookie. Add same-origin/Origin controls for unsafe admin-cookie requests.
- [ ] 2.6 Add integration tests proving revocation works across simulated workers and that the administrator UI can log in, refresh, log out, and recover a disabled/expired session. Do not log credentials in test snapshots.

## 3. Backup and database maintenance boundaries

- [ ] 3.1 Inventory each action exposed by `admin/src/views/DatabaseView.vue` and each route in `backend/src/routes/backup.routes.js`; map the required business role, tenant scope, data fields, and whether each operation can remain online.
- [ ] 3.2 Split read/statistics and write/sync/delete/restore routes into explicit role/permission groups in `backend/src/routes/backup.routes.js`. Move full restore/sync out of public HTTP routes if the UI does not require them.
- [ ] 3.3 Add service/controller authorization and tenant/resource filters in `backend/src/controllers/backup.controller.js`; remove unconditional `withSystemContext(null)` from ordinary request handlers. Require an explicit audited maintenance context for approved global operations.
- [ ] 3.4 Deny generic edits/deletes of `admins`, role/permission/tenant/session fields, credential-bearing fields, and paid/payment state. Apply field allowlists and prevent malicious MongoDB operator/key updates.
- [ ] 3.5 Add safe projections for MongoDB/MySQL reads, exclude hashes/secrets/raw credential-bearing JSON, validate table and field allowlists, require positive limits, and clamp/reject limits above the documented maximum (including `limit=0`).
- [ ] 3.6 Extend `backend/tests/unit/controllers/backup.controller.test.js` and `backend/tests/integration/backup.integration.test.js` for cross-tenant read/write denial, operator/admin escalation rejection, sensitive-field projections, zero/huge page limits, and explicit platform-maintenance success.
- [ ] 3.7 Record successful and denied read/write/export/sync/restore events with actor, role, tenant, collection/object, field names, count, reason, and request ID; redact field values.

## 4. Signed external integrations and migration

- [ ] 4.1 Inventory all workflows that call `/api/v1/enrollments/external/users-by-period` or `/api/v1/insights/external/create`: owner, tenant, n8n version, retry/timeout behavior, outbound addresses, and use of returned fields. Confirm the pending automation/TODO with its owner.
- [ ] 4.2 Add a tenant-bound external-client credential model/service and secret storage using an approved encrypted-at-rest key separate from JWT/database keys. Add route-specific permissions, key IDs, rotation/revocation, and non-secret diagnostics.
- [ ] 4.3 Implement HMAC request verification middleware for method, canonical path/query, timestamp, nonce, and canonical body; use `crypto.timingSafeEqual`, bounded clock skew, and Redis atomic nonce consumption. Fail closed if signature/replay verification cannot complete.
- [ ] 4.4 Apply the verifier to the roster GET and external feedback create/update POST in `backend/src/routes/enrollment.routes.js` and `backend/src/routes/insight.routes.js`. Keep `X-Tenant-Slug` / `X-Wx-AppId` as tenant selectors, not credentials. Keep only verified non-sensitive active-period discovery public.
- [ ] 4.5 Limit roster responses to necessary fields and tenant/period scope. Protect external upsert so an integration cannot overwrite feedback outside its granted tenant/period/user scope.
- [ ] 4.6 Update `docs/guides/EXTERNAL_API_GUIDE.md` with secretless examples, signed-request test vectors, rotation steps, errors, and a clear statement that tenant slug is not authentication. Place production secrets only in the approved integration secret store.
- [ ] 4.7 Add positive/negative/replay/cross-tenant tests to backend integration tests; prove invalid callers cannot read a roster or create/update an insight before data queries execute.
- [ ] 4.8 Migrate the real n8n workflows in staging and production with a dated transition window. Capture caller success/error counters, then remove all unsigned fallback behavior.

## 5. Provider-confirmed payment settlement

- [ ] 5.1 Confirm with the merchant account owner which WeChat Pay protocol/API generation and merchant test environment the configured tenant credentials use; record supported query response, signature, amount, currency, AppID, merchant, and order fields.
- [ ] 5.2 Implement a server-side signed order-query method in `backend/src/services/payment.service.js`; never call it using credentials from the client or log its signature/secret.
- [ ] 5.3 Change `backend/src/controllers/payment.controller.js` so client `transactionId` is never proof of payment. Only a verified callback or signed query with a successful provider state and exact tenant/order/merchant/AppID/currency/amount match can settle.
- [ ] 5.4 Preserve atomic idempotent transitions and update `Payment`, `Enrollment`/registration, coupons, notifications, and sync events only once after provider verification. Record mismatches/timeouts as pending/reconciliation events.
- [ ] 5.5 Validate callback signatures/amount/order fields in the same settlement service. Add test fixtures for fake transaction IDs, bad signatures, wrong merchant/app/amount/tenant, order-not-found, timeout, duplicate callback/query, and a real success sandbox response.
- [ ] 5.6 Reconcile the 49 post-2026-09-05 positive-amount completed orders identified in the security review against merchant-side transaction records before closing the historical exposure investigation.

## 6. Rate limits, logging, network, and dependency updates

- [ ] 6.1 Mount `rateLimitMiddleware` or a reviewed replacement on admin/mini-program authentication, refresh, external routes, backup/export, and uploads in the route/app files. Use account+IP and integration+tenant+IP keys with bounded response and tested Redis-outage behavior.
- [ ] 6.2 Configure trusted proxy hops for the verified same-host Nginx topology; bind Node to `127.0.0.1` in `backend/src/server.js`. Verify Nginx `proxy_pass`, WebSocket, health checks, PM2, background jobs, and cloud firewall rules before enabling.
- [ ] 6.3 Set the production environment file to least-privilege ownership/mode. Inventory active listeners and cloud security-group/WAF policy for 3000, database and Redis ports; bind/restrict each service according to all same-host consumers.
- [ ] 6.4 Update request logging/audit middleware to omit query strings, authorization headers, tokens, passwords, signed bodies, and provider secrets while preserving request IDs and sensitive action evidence. Test deliberate redaction with sentinel values.
- [ ] 6.5 Re-run `npm audit --omit=dev` for backend and admin, inspect current upstream advisories including the full Multer advisory set, and choose fixes with the complete advisory status recorded. Treat `xlsx` without an automatic fix separately. Upgrade the minimum compatible package set and lockfiles; do not run `audit fix --force`.
- [ ] 6.6 Upgrade Multer to a release confirmed to fix all advisories present at implementation time (the currently reviewed installation is `1.4.5-lts.2`; do not treat the March 2026 `2.1.1` fix floor as sufficient without checking the later 2026 advisories). Validate avatars, document/media upload limits, abort cleanup, and admin XLSX export.
- [ ] 6.7 Add and validate alert thresholds for repeated admin-login failures, disabled/unknown admin subjects, cross-tenant denials, high-rate integration calls, large reads/exports, payment mismatches, and revoked-key use.

## 7. Release, evidence, and closeout

- [ ] 7.1 Back up relevant configuration/data using approved backup procedures; verify restore readiness without running any database init/reset script. Record deployed source commit/digest and secret version references, never secret values.
- [ ] 7.2 Run focused backend unit/integration and admin/miniprogram regression tests for the changed flows; run strict OpenSpec validation. Fix any new failure before staging.
- [ ] 7.3 In staging, verify all positive, negative, replay, tenant-isolation, revocation, payment, upload, and rollback cases. Do not use real user, public-GitHub, or live-payment credentials in synthetic tests.
- [ ] 7.4 Deploy one phase at a time, preserve emergency WAF/route restrictions through code acceptance, rotate the discovered production credentials, and observe signed integration, admin, payment, and background-job health.
- [ ] 7.5 Verify from outside the host that port 3000 and database/Redis ports are not directly reachable according to the intended cloud policy; verify the supported HTTPS domain and admin/mobile flows remain available.
- [ ] 7.6 Review the two unresolved admin logins from the audit TODO with their owners. Mark incident conclusions only after corroborating source logs, account action logs, and available payment/provider evidence.
- [ ] 7.7 Close checklist items only with linked code/tests/release/evidence references. Archive this OpenSpec change and establish its final capability baselines after successful deployment.
