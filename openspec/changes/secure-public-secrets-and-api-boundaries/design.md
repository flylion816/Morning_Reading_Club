## Context

The security review dated 2026-10-12 found production-equivalent source code in a public repository, production credentials repeated in tracked files, and routes whose tenant context does not prove caller identity. Administrator JWTs currently grant authority from token claims without looking up the current administrator record. Backup write/delete handlers run under a global tenant bypass, the external participant-list and feedback-write routes have no service authentication, and the user payment-confirm endpoint trusts a client-supplied transaction identifier.

The repository uses Node.js/Express, MongoDB/Mongoose tenant context, Redis where configured, a Vue administrator site served on the same origin as the API, an existing n8n-backed external integration, and a same-host Nginx reverse proxy. The existing `X-Tenant-Slug` feature remains useful for selecting a tenant. A slug or WeChat AppID is public routing context, not a caller credential.

This repository has historical change specifications under `openspec/changes/` but no `openspec/specs/` baseline directory. This proposal creates explicit requirements for the secured capabilities; it does not silently treat old proposal deltas as already archived current-state specifications.

## Goals / Non-Goals

### Goals

- Make every credential retrieved from public Git content unusable against production.
- Make administrator authority depend on a live enabled account and current permission/tenant state, with a usable revocation path.
- Remove generic cross-tenant maintenance writes and field-level privilege escalation.
- Authenticate the two sensitive external integration routes without turning tenant identifiers into secrets.
- Update payment state only on authenticated provider evidence.
- Keep existing authorised mini-program, administrator, n8n, and WeChat Pay flows working through a deliberate migration.
- Make each phase independently testable, observable, and reversible without restoring public credentials or a known authorization bypass.

### Non-Goals

- This proposal does not claim that every alert, password probe, or request seen in shared Nginx logs belongs to this project or to the actor described in the supplied security documents.
- It does not infer the number of affected people from request counts.
- It does not redesign the course, check-in, public active-period discovery, or ordinary user flows unless a concrete permission test exposes a related access-control defect.
- It does not rotate shared database/Redis credentials until all consumers and a coordinated cutover are identified.
- It does not erase database records or run any `init-*`, restore, or reset script.

## Decisions

### 1. Treat all public production-equivalent credentials as compromised

First preserve repository visibility/audit evidence and identify all active consumers. Restrict public access promptly, then rotate the known JWT access/refresh keys and all production service credentials that were confirmed in the public tree. Coordinate credentials shared with other services. Do not assume changing GitHub visibility or deleting the latest `.env` file retracts copies already made. Do not rewrite history until evidence has been retained and repository consumers/forks have been accounted for. Remove the secret material from reachable branches and generated deployment assets after rotation.

Production and staging must have independent random keys. Startup validation must reject missing, short, known-default, or cross-purpose JWT keys in every non-test environment. The test environment must use explicit test-only fixtures instead of production code fallbacks.

### 2. Put administrator revocation behind a live session check

Give user access, administrator access, administrator refresh, and WebSocket tokens distinct purposes (`typ`/token class), audience and issuer claims, and separate signing keys. The administrator access token should be short lived. On each administrator request, `adminAuthMiddleware` must load the account by the token subject and compare its current status, role, tenant, and session version with the signed claims. Missing, disabled, deleted, changed-role, wrong-audience, wrong-purpose, expired, or revoked credentials fail closed before `next()`.

Use a server-managed administrator session/version for refresh rotation and revocation. A refresh credential is single-use and rotated when renewed. Logout, password reset, disablement, role/tenant change, and security-driven key rotation revoke the affected session(s). Reuse of a rotated refresh token revokes the session family and emits a security audit event. Never log full tokens or refresh credentials.

For the Vue administrator site, replace the persistent bearer token in `localStorage` with a `Secure`, `HttpOnly`, `SameSite=Strict` refresh cookie scoped to the administrator authentication paths and a short-lived access token kept in memory. Because the site and API share the same host, keep the admin API same-origin and validate `Origin` on state-changing requests. Preserve the mini-program's bearer-token flow but give it a separate audience and key.

### 3. Remove generic global bypass from ordinary administrator maintenance requests

Split `backup.routes.js` into explicit capability tiers. Read-only aggregate statistics may receive a narrowly scoped permission. Record reads must have a tenant-bound filter, maximum page size, and safe field allowlist. Generic update/delete endpoints must not mutate `admins`, tenant configuration, credentials, roles, payment state, or other security-sensitive collections. Cross-tenant backup/sync/restore operations are maintenance actions that require a platform-level role plus a dedicated permission and step-up confirmation; prefer an audited CLI/runbook over publicly mounted HTTP routes for full sync/restore if the administrator UI does not require them.

The controller/service must enforce the rule even when invoked without the expected router, and audit the authenticated actor, tenant scope, collection, record ID, changed field names, and result. Never write full before/after credential values into the audit log. Deny-by-default query limits apply to MongoDB and MySQL; SQL identifiers remain allowlisted and values parameterized.

### 4. Separate external caller authentication from tenant resolution

Keep `X-Tenant-Slug` and `X-Wx-AppId` for backwards-compatible tenant resolution. For `GET /api/v1/enrollments/external/users-by-period` and `POST /api/v1/insights/external/create`, require a tenant-bound integration identity and HMAC signature covering the method, canonical path/query, timestamp, nonce, and canonical request body. Compare signatures in constant time, accept a small clock-skew window, and atomically consume each nonce once. Use distinct credentials per integration and tenant, `select: false` or encrypted-at-rest storage, narrow route permissions, explicit key IDs, and a tested rotation path. Signature verification and replay storage failures fail closed for these routes.

Migrate the existing n8n caller before enforcing the new requirement. Record which job/credential owns each integration. If rollout requires a short dual-credential period, bound it to a named migration window and known caller identity; do not leave a permanent anonymous or Referer/UA-only fallback. Keep non-sensitive active-period discovery public only after verifying its returned fields. Minimize roster responses to the fields the integration actually needs.

### 5. Settle payments from provider evidence only

`POST /api/v1/payments/:paymentId/confirm` must treat the client transaction ID as untrusted. It may initiate an authenticated server-side order query using the configured WeChat Pay protocol. The settlement service accepts success only after checking the provider signature or trusted signed API response, tenant, AppID, merchant ID, merchant order number, transaction ID, currency, and exact amount against the stored payment. The provider state must be the documented successful state. Client input alone never changes `Payment.status` or `Enrollment.paymentStatus` to paid.

Keep callback verification and the query path idempotent with an atomic `pending/processing -> completed` transition. A provider timeout or mismatch leaves the payment pending/failed safely and produces a traceable reconciliation event. The current payment service uses the legacy V2 unified-order endpoint; verify that this is still the merchant's active API generation before implementation. For V2, use the official [`pay/orderquery` merchant specification](https://pay.wechatpay.cn/doc/v2/merchant/4011935215) and [V2 server-side development guide](https://pay.wechatpay.cn/doc/v2/merchant/4011936686); if the merchant is on V3, follow its current official query/signature documentation instead. Build fixtures from the confirmed merchant configuration; do not guess V2/V3 fields from a generic sample.

### 6. Put guardrails where the request enters the system

Apply separate IP+account limits to mini-program/admin login, and integration-key+tenant+IP limits to external API requests. Apply high and explicit limits to export, backup query and upload paths. The current `rateLimitMiddleware` is not mounted and calls `next()` when Redis checks fail; route-specific controls must be mounted and their Redis-unavailable behavior must be explicit. Never silently bypass authorization to preserve availability.

After confirming the same-host Nginx topology, bind Node.js port 3000 to `127.0.0.1`; retain Nginx proxying and the existing HTTPS hostname. Set Express proxy trust to the exact known proxy hop/network so `req.ip` is not spoofable from a direct client. Obtain and review Tencent Cloud security-group/WAF rules before claiming that database or alternate listening ports are Internet-reachable. Fix filesystem permissions for the production environment file to the least access needed by the service account.

The request log must omit query strings and redact credentials; authentication failures should record a stable reason code, route, tenant, request ID, and privacy-reviewed caller key fingerprint rather than token, password, body, or full secret.

### 7. Upgrade dependencies based on the current advisory set, not one CVE

Start with the reviewed locks and production versions: backend `axios 1.13.2`, `mongoose 8.19.3`, `ws 8.20.1`, `proxy-addr 2.0.7`, `multer 1.4.5-lts.2`; admin `axios 1.13.2` and `xlsx 0.18.5`. Run `npm audit` against backend/admin lock files and a current maintained advisory source. The installed Multer is below the patched floor in the upstream [GHSA-5528-5vmv-3xc2 advisory](https://github.com/expressjs/multer/security/advisories/GHSA-5528-5vmv-3xc2), and the maintainers list additional advisories published in Aug/Sep 2026 in their [current advisory list](https://github.com/expressjs/multer/security/advisories). Upgrade to a release whose full current advisory list covers all of them; the March 2026 Multer fix floor alone is not sufficient evidence. Review `xlsx` separately because the reviewed npm audit had no automatic fix recommendation. Do not use broad `npm audit fix --force`; pin/update the minimal compatible set and verify file-upload, XLSX export, admin rendering, payments, and mini-program flows.

### 8. Maintain an evidence and release gate

Record a request ID at ingress and retain appropriately sized immutable access/audit logs. Log successful and failed sensitive reads, not only writes. Keep business status separate from HTTP status. Build a production inventory of domains, direct origins, listening ports, WAF rules, security groups, and log-retention windows before declaring the network perimeter closed.

Use an additive session/credential migration and a tested backup before any required schema change. Do not run database initialization/reset scripts. Stage validation before each rollout; deploy the reversible host binding and route guards with known Nginx topology; rotate keys and reject old credentials; migrate the signed integration client; then deploy provider-confirmed settlement. Preserve cloud/WAF emergency blocks until the matching code fix has passed acceptance. A rollback may revert code only while the emergency edge blocks and newly rotated keys remain active; never roll back to a public key or restore a bypass route.

## Risks / Trade-offs

- **JWT rotation signs out existing users/admins.** Notify operators, confirm WeChat re-login works, and schedule shared service-key rotation with dependent products. Revocation is an intended security consequence, not a rollback failure.
- **Per-request administrator lookup adds database traffic.** Add the account/session indexes and measure under expected admin traffic. Do not replace current status checks with a long-lived process cache that delays revocation across four workers.
- **Removing backup-wide access can change maintenance workflows.** Identify the current DatabaseView pages and every action before closing or splitting endpoints; preserve authorized read-only capabilities with safe projections.
- **Signed external requests require n8n coordination.** Inventory n8n workflows, tenant mapping, retries and schedules first. Run staging signing/replay tests. The final anonymous fallback removal is a release gate.
- **Provider order queries depend on account configuration and API version.** Confirm merchant protocol, credentials, callback config and provider test tools with the payment owner; never test payment writes in production.
- **Dependency majors can break upload/UI behavior.** Stage library upgrades separately with targeted regression tests and a lockfile-reviewed rollback candidate.
- **Network restrictions can break background jobs.** Check scheduler/worker connectivity to local backend and databases before tightening ports; a cloud security-group screenshot/JSON export and host listener check are separate evidence.
- **Public-repository history remains copied even after a privacy change.** Rotate keys even if forks are not visible and retain a dated incident record; history rewriting alone is not remediation.

## Migration Plan

1. Preserve the public-file hashes and repository visibility/audit evidence; restrict access to the repository. Inventory key consumers and coordinate the n8n/payment/other-project owners.
2. Rotate the revealed credentials in dependency order. For shared MySQL/Redis credentials, introduce least-privilege dedicated credentials if supported and move one consumer group at a time. Issue independent new production JWT keys, restart all workers, and reject old access/refresh tokens. Verify the mini-program/admin site, WebSocket, database, Redis and background tasks.
3. Implement backend live-identity checks, session/refresh revocation, narrowly authorized database maintenance, signed integration auth, provider-confirmed payments and rate-limits. Add focused negative and positive tests before deploying.
4. Update n8n with tenant-bound HMAC credentials in staging, then migrate production integration with a short explicitly dated transition. Remove the compatibility bridge at the end of the window.
5. Upgrade dependencies and bind the backend listener to loopback; validate Nginx origin forwarding, cloud WAF/security-group rules, upload/download flows and direct-port denial.
6. Reconcile provider transactions against the merchant ledger; review the two unresolved successful admin logins recorded in the Oct 12 audit; record conclusions without inferring exposure from IP-only evidence.
7. Retain edge emergency blocks until all related application acceptance checks pass. Close the OpenSpec tasks only after logs, tests, dependency inventory, credential invalidation, release commit/build identity, and post-deploy checks are recorded.

## Open Questions

- Who administers the public GitHub repository and can restrict it immediately? What automations/deployment keys need to remain enabled after visibility changes?
- Which backend, admin, sync, scheduled, and other same-host services share the currently exposed MySQL/Redis credentials?
- Which n8n workflows, tenants, outbound IPs, retries and owners call the two sensitive external routes? Is there a credential store available for per-tenant integration secrets?
- Does the merchant account use the legacy V2 protocol configured in the current backend, and which non-production merchant/test environment is available for order-query acceptance?
- Which cross-tenant DatabaseView actions are still needed, who may approve them, and can full sync/restore be moved to an audited operations CLI?
- Which cloud WAF/security-group rules currently protect `wx.shubai01.com`, the server origin, and Docker-published database ports? Which log sources cover the gap before 2026-09-27?
