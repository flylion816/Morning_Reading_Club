## ADDED Requirements

### Requirement: Administrator enrollment cancellation
The system SHALL allow an authenticated tenant administrator to cancel an active enrollment without deleting its historical record.

#### Scenario: Cancel an active enrollment
- **GIVEN** an active, non-deleted enrollment in the administrator's tenant
- **WHEN** the administrator confirms cancellation
- **THEN** the enrollment status becomes `withdrawn`
- **AND** `withdrawnAt` is recorded
- **AND** the period enrollment count decreases
- **AND** the original form answers and payment fields remain available

#### Scenario: Cancel a non-active enrollment
- **GIVEN** an enrollment is already withdrawn, completed, or missing
- **WHEN** the administrator requests cancellation
- **THEN** the system returns an error and does not change the period count
