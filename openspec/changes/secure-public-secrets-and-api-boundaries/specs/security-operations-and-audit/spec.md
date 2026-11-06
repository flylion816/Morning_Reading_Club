## ADDED Requirements

### Requirement: Sensitive endpoints use rate limits and fail-closed authorization
Authentication, administrator-session refresh, external integrations, upload, export, and maintenance endpoints SHALL have explicit per-IP/account/integration/tenant rate limits and documented Redis-unavailable behavior. Authorization and replay checks SHALL fail closed.

#### Scenario: An authentication or export limit is exceeded
- **WHEN** a caller exceeds its documented rate limit
- **THEN** further requests are rejected with a rate-limit response and a privacy-safe security event is recorded

#### Scenario: Redis is unavailable during sensitive authorization
- **WHEN** a request depends on a session/replay/limit check that cannot be completed
- **THEN** the sensitive route is denied or placed into a documented controlled-degraded mode and is not silently authorized

### Requirement: Sensitive request logs minimize secrets and support incident response
The system SHALL retain traceable security evidence for authentication failures, session changes, sensitive reads, integration writes, payment settlement, and maintenance operations while excluding full tokens, passwords, signed bodies, query credentials, and provider secrets.

#### Scenario: A request includes query parameters or authentication headers
- **WHEN** the HTTP/access logger records the request
- **THEN** it records a normalized path and request ID without credential-bearing query values or authentication headers

#### Scenario: A sensitive read is successful
- **WHEN** backup data, participant rosters, or payment state is read
- **THEN** an actor/integration, tenant scope, safe object reference, result size, status, and trace ID can be used to investigate the request

### Requirement: Production backend and secret files are constrained
The backend SHALL listen only on loopback when fronted by the verified same-host Nginx proxy. Production secret files SHALL have least-privilege owner/mode, and proxy trust SHALL match the actual trusted proxy topology.

#### Scenario: A client bypasses the public HTTPS reverse proxy and targets port 3000
- **WHEN** a remote client tries to reach the Node.js listener directly
- **THEN** the service is not listening on a public interface; the supported Nginx HTTPS path still reaches the API

#### Scenario: An external request supplies a forged forwarded-client address
- **WHEN** a request crosses the untrusted network boundary
- **THEN** rate-limit keys and audit IP attribution use only the address forwarded by the verified proxy chain
