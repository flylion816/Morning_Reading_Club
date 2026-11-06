# Change: Secure published credentials and sensitive API boundaries

## Why

The 2026-10-12 security review confirmed that the public GitHub repository exposes files whose credential values match the production JWT signing keys and several production service credentials. With the exposed JWT key, a synthetic administrator token passed the production-matching authentication middleware. The review also confirmed a cross-tenant administrator write path, two unauthenticated external integration routes, and client-triggered payment completion without a provider query.

These findings create direct confidentiality and integrity risks. Public scanning is present in the production logs, while those logs do not establish whether any of these flaws were exploited. This change closes the confirmed paths, rotates the exposed secrets, and adds the session, request-authentication, audit, and release controls needed to prevent recurrence.

## What Changes

- **Contain and rotate published credentials.** Restrict repository access, inspect all reachable Git history and release artifacts, rotate every value confirmed to be shared with production, and ensure old JWTs cease to authenticate. Remove production-capable secret fallbacks from code and generated configuration.
- **Verify administrator identity and current privileges.** Give administrator access and refresh tokens distinct purposes, issuers, audiences, secrets, and lifetimes. Check the live administrator status, role, tenant binding, and session version before allowing a request. Revoke sessions on logout, password reset, disablement, role changes, and signing-key rotation.
- **Constrain backup and database maintenance APIs.** Split read and write operations, require a narrowly defined maintenance permission, enforce tenant and record ownership at the service boundary, cap query sizes, redact sensitive fields, and reject writes to administrator/security fields through generic record endpoints.
- **Authenticate sensitive external integrations.** Keep tenant slugs as tenant identifiers; add signed service identity with timestamp, request replay protection, credential rotation, tenant scoping, and rate limits to the external participant-list and feedback-write endpoints. Keep public active-period discovery available if the response remains non-sensitive.
- **Confirm payments on the server.** Treat the client transaction ID as a lookup hint only. Verify a signed provider notification or query WeChat Pay from the server, then match the tenant, app, merchant, order, amount, and successful provider state before marking an order paid.
- **Add focused protections and evidence.** Apply rate limits to authentication and sensitive operations, fail closed for high-risk authorization checks, minimize request logging, review current dependency advisories, bind the API to loopback behind the existing local Nginx proxy, and retain actor/tenant/object audit data for sensitive reads and writes.

## Impact

- **Affected capabilities:** new `administrator-authentication-and-sessions`, `privileged-data-maintenance`, `external-integration-authentication`, `payment-settlement-verification`, and `security-operations-and-audit` requirements.
- **Likely code:** `backend/src/utils/jwt.js`, `backend/src/middleware/adminAuth.js`, `backend/src/middleware/auth.js`, `backend/src/middleware/ratelimit.js`, `backend/src/routes/admin.routes.js`, `backup.routes.js`, `insight.routes.js`, `enrollment.routes.js`, `payment.routes.js`, corresponding controllers and models, `backend/src/app.js`, `backend/src/server.js`, and the admin API/auth store.
- **External dependencies:** GitHub repository administrators, production operations, WeChat Pay merchant configuration, and the n8n/integration owners for existing external calls.
- **Deployment impact:** credential rotation invalidates outstanding administrator tokens. The external integration callers need a signed-request credential before their protected routes are enabled. The API must remain reachable through `wx.shubai01.com` after it binds to loopback. Production database data is preserved; no initialization or reset script is part of this plan.
- **Approval boundary:** this proposal describes the implementation plan. Code and production changes start only after review and approval under the project OpenSpec workflow.

## Evidence baseline

The 2026-10-12 review matched 25 key deployed files to the local checkout and confirmed anonymous access to the public-branch copies of exposed configuration files. It validated the administrator-token, backup-write, and payment-confirmation flaws with synthetic in-memory data. The report found production scans, but it did not establish bulk data exfiltration or attribution of two successful administrator logins. Those logins and merchant-ledger reconciliation remain follow-up evidence tasks; neither is a reason to weaken the repair requirements.
