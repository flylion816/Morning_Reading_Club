## ADDED Requirements

### Requirement: Security event alerting
The backend SHALL record threshold-based alerts for high-risk authentication, tenant boundary, external integration, bulk read, and payment verification events.

#### Scenario: Repeated admin login failures
- **WHEN** the same administrator identity and client fail login five times in fifteen minutes
- **THEN** the system records a high-severity alert without exposing the raw email or IP.

### Requirement: External integration abuse alerting
The backend SHALL alert when external integration callers exceed rate limits or repeatedly use unknown or revoked keys.

#### Scenario: Revoked key is used
- **WHEN** a revoked external integration key attempts an authenticated request
- **THEN** the request is rejected and a high-security alert is recorded.

### Requirement: Sensitive bulk read alerting
The backend SHALL alert when monitored backup, audit export, or database maintenance responses exceed one megabyte.

#### Scenario: Large export response
- **WHEN** an administrator exports more than one megabyte from a monitored endpoint
- **THEN** the system records an alert containing a hashed actor and endpoint rather than exported data.

### Requirement: Payment mismatch alerting
The backend SHALL immediately alert when a provider query or payment callback fails signature or order matching.

#### Scenario: Callback amount does not match stored order
- **WHEN** a signed payment callback contains payment details inconsistent with the stored order
- **THEN** settlement is rejected and a critical alert is recorded.
