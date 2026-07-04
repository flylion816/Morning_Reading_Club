## ADDED Requirements
### Requirement: Multiple Activity Types For Imprints
The system SHALL allow an imprint to be assigned one or more active activity types.

#### Scenario: User publishes a multi-type imprint
- **GIVEN** a signed-in paid user is creating an imprint
- **WHEN** the user selects multiple activity types and submits valid media and title
- **THEN** the imprint is saved with all selected activity type keys
- **AND** the legacy `activityType` field is set to the first selected key.

#### Scenario: User edits a historical single-type imprint
- **GIVEN** an existing imprint only has the legacy `activityType` field
- **WHEN** the edit page opens
- **THEN** the page treats the legacy value as a one-item `activityTypes` selection.

#### Scenario: List filters by one selected type
- **GIVEN** imprints exist with either `activityType` or `activityTypes`
- **WHEN** the user filters the list by a type key
- **THEN** imprints containing that key in either field are returned.
