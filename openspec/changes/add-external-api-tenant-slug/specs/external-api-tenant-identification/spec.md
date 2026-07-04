## ADDED Requirements
### Requirement: External API Tenant Slug Identification
The system SHALL allow external public APIs to resolve tenant context using the `X-Tenant-Slug` request header.

#### Scenario: Request uses tenant slug
- **WHEN** an external public API request includes `X-Tenant-Slug` for an active tenant
- **THEN** the request runs in that tenant's context

#### Scenario: Request uses legacy AppID
- **WHEN** an external public API request includes `X-Wx-AppId` and no tenant slug
- **THEN** the request continues to resolve the tenant from the WeChat AppID

#### Scenario: Request sends conflicting identifiers
- **WHEN** an external public API request includes both `X-Tenant-Slug` and `X-Wx-AppId`
- **AND** they resolve to different active tenants
- **THEN** the request is rejected without running tenant-scoped business logic

### Requirement: Active Period Discovery By Tenant Group
The system SHALL return active periods grouped by tenant for external schedulers, with optional filtering by stable `tenantSlug` while retaining `tenantName` compatibility.

#### Scenario: Caller queries by tenant slug
- **WHEN** a caller requests active periods with `tenantSlug`
- **THEN** the response contains one tenant group
- **AND** that group includes tenant metadata and the active period list for that tenant

#### Scenario: Caller queries all tenants
- **WHEN** a caller requests active periods without `tenantSlug` or `tenantName`
- **THEN** the response contains tenant groups for all active tenants
- **AND** each group includes tenant metadata and that tenant's active periods

#### Scenario: Caller queries by legacy tenant name
- **WHEN** a caller requests active periods with `tenantName`
- **THEN** the response contains one tenant group for that tenant name
