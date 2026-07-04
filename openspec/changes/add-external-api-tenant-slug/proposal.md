# Change: Add tenant slug for external APIs

## Why
External systems currently identify tenants with `X-Wx-AppId` after a lookup by display tenant name. AppID is a WeChat integration detail, while tenant slug is the stable business identifier used by onboarding and backend tenant records.

## What Changes
- Add `X-Tenant-Slug` as the recommended tenant identifier for public external APIs.
- Keep `X-Wx-AppId` as a backwards-compatible identifier.
- Reject requests that provide both identifiers when they resolve to different tenants.
- Support `tenantSlug` on the active-periods discovery endpoint while retaining `tenantName` compatibility.
- Update the external API guide examples to use tenant slug.

## Impact
- Affected specs: external-api-tenant-identification
- Affected code: `backend/src/middleware/tenantContext.js`, `backend/src/controllers/enrollment.controller.js`, `docs/guides/EXTERNAL_API_GUIDE.md`
