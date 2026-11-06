## ADDED Requirements

### Requirement: Maintenance APIs enforce an explicit privilege
Backup, synchronization, data comparison, record editing/deletion, and restore APIs SHALL enforce a documented maintenance permission in both their route and service/controller boundary. Global tenant bypass SHALL NOT be inferred merely from administrator authentication or an HTTP request.

#### Scenario: An ordinary tenant administrator calls a cross-tenant maintenance route
- **WHEN** the administrator lacks the required maintenance permission or tenant scope
- **THEN** the request is denied before a database query or mutation occurs

#### Scenario: A cross-tenant maintenance action is approved
- **WHEN** an authorized platform operator selects a maintenance action with an approved scope
- **THEN** the service uses that explicit scope and records the operator, tenant scope, target, action, reason, request ID, and result

### Requirement: Generic record APIs cannot edit security authority
Generic maintenance endpoints SHALL reject updates/deletes to administrator identity, roles, permissions, tenant bindings, credential fields, payment settlement state, and other security-sensitive fields unless a dedicated authorized workflow validates those fields.

#### Scenario: A caller submits a role or tenant-binding field to the generic record endpoint
- **WHEN** the requested collection or field is security sensitive
- **THEN** the operation is rejected before the model writes or synchronization event is published

### Requirement: Maintenance reads have bounded scope and safe projections
Database read APIs SHALL constrain tenants and records to the caller’s permitted scope, impose a positive hard maximum page size, and return an explicit safe projection rather than a full record.

#### Scenario: The caller requests an unlimited or excessive page
- **WHEN** page size is zero, negative, invalid, or exceeds the endpoint maximum
- **THEN** the request is rejected or clamped according to the documented API contract, and no unbounded query runs

#### Scenario: An administrator reads an account record
- **WHEN** a maintenance read returns administrator data
- **THEN** password hashes, database-access hashes, session secrets, integration credentials, and raw credential-bearing backup fields are omitted

### Requirement: Sensitive maintenance reads and writes are auditable
The system SHALL emit actor-attributed audit events for successful and denied maintenance reads, writes, deletes, synchronization, and restore operations, without storing full credentials or sensitive record contents.

#### Scenario: A backup export or table read completes
- **WHEN** sensitive records are returned
- **THEN** the audit record contains the caller, tenant scope, operation, safe collection/object reference, row count, status, and trace ID
