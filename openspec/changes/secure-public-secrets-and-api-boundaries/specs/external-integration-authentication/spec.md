## ADDED Requirements

### Requirement: Tenant identification is distinct from integration authentication
The system SHALL continue to use `X-Tenant-Slug` and the supported legacy `X-Wx-AppId` for tenant resolution, but SHALL require an authenticated integration identity for external endpoints that disclose user rosters or create/update feedback.

#### Scenario: A caller only supplies a public tenant slug
- **WHEN** the caller requests `/api/v1/enrollments/external/users-by-period` or `/api/v1/insights/external/create` without a valid integration signature
- **THEN** the request is denied before roster data is read or feedback is created/updated

#### Scenario: A non-sensitive active-period discovery request uses an active tenant
- **WHEN** an unauthenticated caller requests only the documented public active-period metadata
- **THEN** the endpoint returns only the approved public fields and does not expose participant identity or credentials

### Requirement: Sensitive external integrations use signed, tenant-scoped requests
The system SHALL authenticate sensitive external requests using a tenant-bound, rotatable integration key and a signature covering the method, canonical route/query, timestamp, nonce, and canonical body. It SHALL compare signatures safely, enforce a bounded clock window, consume nonces atomically, and limit each integration’s routes and tenant scope.

#### Scenario: An approved n8n integration calls the participant-list endpoint
- **WHEN** the integration sends a valid signature, tenant, timestamp, and unused nonce
- **THEN** the endpoint returns only the minimum required participant fields for that tenant and requested period

#### Scenario: A captured signed request is replayed
- **WHEN** a previously consumed nonce is reused within the allowed time window
- **THEN** the request is denied and no feedback or roster data is returned

#### Scenario: Signature, credential, tenant binding, or nonce storage is invalid
- **WHEN** signature validation fails, the key is inactive, the key belongs to another tenant, the timestamp is outside the accepted window, or replay protection is unavailable
- **THEN** the request fails closed and a privacy-safe security event is recorded

### Requirement: External integration credentials are stored and rotated safely
Integration secrets SHALL be unique per caller/tenant, excluded from source code and API responses, stored using an approved encrypted secret mechanism, and revocable/rotatable without exposing their values in logs.

#### Scenario: An integration key is rotated
- **WHEN** operations activates the replacement key and revokes the old key at the end of the migration window
- **THEN** requests signed only by the old key are denied and the replacement caller remains scoped to its configured tenant and endpoints
