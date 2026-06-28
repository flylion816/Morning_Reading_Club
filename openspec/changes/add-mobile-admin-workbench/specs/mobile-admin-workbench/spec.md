## ADDED Requirements

### Requirement: Mobile Admin Workbench Authorization
The system SHALL expose mobile admin workbench APIs only to authenticated mini program users whose user role is `admin` or `super_admin`.

#### Scenario: Normal user is denied
- **GIVEN** a mini program user with role `user`
- **WHEN** the user calls a mobile admin workbench endpoint
- **THEN** the system returns 403

### Requirement: User Lookup
The system SHALL allow a mobile administrator to search users by nickname, phone, or enrollment name and view compact user cards.

#### Scenario: Administrator searches by phone
- **GIVEN** a mobile administrator enters a phone fragment
- **WHEN** the administrator searches users
- **THEN** matching users are returned with nickname, masked phone, status, and summary counts

### Requirement: Enrollment And Payment Lookup
The system SHALL allow a mobile administrator to view a selected user's period enrollments and their latest payment state.

#### Scenario: Administrator opens user detail
- **GIVEN** a mobile administrator selected a user
- **WHEN** the detail view loads
- **THEN** the system shows the user's enrollments with period name, enrollment status, payment status, amount, and latest order state

### Requirement: Activity Registration Lookup
The system SHALL allow a mobile administrator to view community activities and each activity's registration list.

#### Scenario: Administrator opens activity registrations
- **GIVEN** a mobile administrator selected an activity
- **WHEN** the registration list loads
- **THEN** the system shows registered users, registration status, payment status, paid amount, and latest payment state
