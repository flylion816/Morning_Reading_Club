## ADDED Requirements

### Requirement: Activity Registration Form Configuration
The system SHALL allow administrators to configure a custom registration form per community activity.

#### Scenario: Administrator enables a form
- **GIVEN** an administrator is creating or editing a community activity
- **WHEN** the administrator enables registration information collection and adds valid fields
- **THEN** the system saves the ordered field configuration with stable field ids, labels, types, required flags, options, placeholders, and stats settings

#### Scenario: Administrator saves invalid options
- **GIVEN** an administrator adds a single-select or multi-select field
- **WHEN** the field has fewer than one valid option
- **THEN** the system rejects the activity save with a validation error

### Requirement: Activity Registration Answer Submission
The system SHALL require users to submit answers matching the activity's registration form before completing activity registration.

#### Scenario: Free activity with required fields
- **GIVEN** a published free activity has registration form required fields
- **WHEN** a user submits valid answers and registers
- **THEN** the system stores the registration, form snapshot, normalized answers, and marks the user registered without payment

#### Scenario: Paid activity with required fields
- **GIVEN** a published paid activity has registration form required fields
- **WHEN** a user submits valid answers and registers
- **THEN** the system stores the registration, form snapshot, normalized answers, returns the existing activity payment payload, and keeps the registration pending until payment succeeds

#### Scenario: Missing required field
- **GIVEN** a published activity has a required registration form field
- **WHEN** a user submits registration without that field's answer
- **THEN** the system rejects the registration and does not create a payment

### Requirement: Registration Answer Snapshots
The system SHALL preserve the form definition used for each submitted activity registration.

#### Scenario: Activity form changes after registrations exist
- **GIVEN** a user registered for an activity and submitted form answers
- **WHEN** an administrator later edits the activity's registration form fields
- **THEN** the user's registration detail still renders using the submitted answers and the original form snapshot

### Requirement: Administrator Registration Answer Review
The system SHALL allow administrators to view submitted registration answers in both PC admin and mobile admin registration lists.

#### Scenario: PC administrator opens registration list
- **GIVEN** an activity has registrations with submitted form answers
- **WHEN** an administrator opens the activity registration list in the PC admin console
- **THEN** the system shows each registrant with payment status, registered time, and submitted answer summaries

#### Scenario: Mobile administrator opens registration detail
- **GIVEN** an activity has registrations with submitted form answers
- **WHEN** a mobile administrator taps a registrant in the mobile registration list
- **THEN** the system shows the registrant's full submitted answers with registration and payment details

### Requirement: Registration Field Statistics
The system SHALL provide field-level people statistics for configured registration form fields.

#### Scenario: Administrator views selectable field stats
- **GIVEN** an activity has a stat-enabled single-select, multi-select, or boolean field
- **WHEN** an administrator opens registration statistics
- **THEN** the system shows counts for each option and allows viewing the people matching that option

### Requirement: User Registration Detail Review
The system SHALL allow users to view their own submitted activity registration details.

#### Scenario: User opens my activities
- **GIVEN** a user has registered for an activity with submitted form answers
- **WHEN** the user opens my activities and chooses to view registration details
- **THEN** the system shows the activity, registration status, payment status, registered time, and submitted answers
