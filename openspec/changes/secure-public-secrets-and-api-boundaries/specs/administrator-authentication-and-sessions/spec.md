## ADDED Requirements

### Requirement: Production signing-key separation and fail-closed startup
The system SHALL require unique, non-default signing keys for each token purpose in every non-test environment, SHALL NOT include operational production credentials or signing keys in tracked source/deployment examples, and SHALL stop startup when a required key is missing, weak, or reused for another token purpose.

#### Scenario: Production configuration omits a required key
- **WHEN** the backend starts outside test mode with a missing, default, or shared access/refresh/WebSocket signing key
- **THEN** startup fails before the HTTP listener accepts requests
- **AND** no hard-coded fallback key is used

#### Scenario: Previously published key is rotated
- **WHEN** production loads a newly issued signing key and an incoming JWT was signed using the previously published key
- **THEN** the JWT is rejected
- **AND** newly authenticated sessions continue through the supported login flow

### Requirement: Administrator tokens prove current administrator authority
The system SHALL accept an administrator request only when the token has an explicit administrator access-token purpose, issuer and audience, is within the configured lifetime, and matches a current enabled administrator account, role, tenant, and session version.

#### Scenario: A client signs a token with an administrator role claim
- **WHEN** a token with a valid cryptographic signature contains an administrator role but does not map to an enabled administrator record with the same current claims
- **THEN** the request is denied before the controller executes

#### Scenario: An administrator is disabled or demoted
- **WHEN** an administrator account becomes disabled, loses its required role, changes tenant, or increments its session version
- **THEN** the next request made with the earlier token is denied across all backend workers

#### Scenario: A token for another purpose is presented to an admin route
- **WHEN** a mini-program access token, refresh token, WebSocket token, or token with the wrong audience/issuer is sent to an administrator API
- **THEN** the request is denied

### Requirement: Administrator sessions can be revoked
The system SHALL rotate administrator refresh credentials and provide a server-side revocation mechanism on logout, password change/reset, account disablement, role/tenant change, and security-driven key rotation.

#### Scenario: A refresh credential is reused
- **WHEN** a previously rotated administrator refresh credential is presented again
- **THEN** the session family is rejected and a security event is recorded without logging the credential

#### Scenario: Administrator logs out
- **WHEN** an administrator logs out
- **THEN** the refresh session is revoked server-side and cannot mint a new access token

### Requirement: Administrator browser credentials are protected
The administrator browser client SHALL NOT persist long-lived bearer tokens in JavaScript-readable `localStorage`; refresh credentials SHALL use `Secure`, `HttpOnly`, `SameSite` cookie protections with a constrained path and origin/CSRF controls.

#### Scenario: The administrator site reloads
- **WHEN** the administrator site reloads or opens a new tab
- **THEN** it obtains or restores a short-lived session using the protected refresh flow, without reading a long-lived refresh token from JavaScript storage
