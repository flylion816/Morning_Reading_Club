## ADDED Requirements
### Requirement: Admin Configurable Homepage Section Order
The system SHALL let an authenticated administrator configure the tenant homepage order for the sections `recentActivities`, `todayTask`, `zaichang`, `myCheckins`, `xiaofanInsights`, and `insightRequests`.

#### Scenario: Administrator saves a valid order
- **WHEN** an administrator submits the six supported section keys in a unique sequence
- **THEN** the system saves the sequence for the current tenant
- **AND** subsequent reads return that sequence.

#### Scenario: Administrator submits an invalid order
- **WHEN** the submitted sequence is missing a supported section key, contains an unknown key, or contains duplicates
- **THEN** the system rejects the request with a validation error.

### Requirement: Miniprogram Homepage Uses Configured Order
The miniprogram homepage SHALL render existing homepage sections in the order returned by the tenant homepage configuration while preserving each section's existing visibility rules.

#### Scenario: Configuration is available
- **WHEN** the miniprogram loads homepage configuration successfully
- **THEN** it orders the homepage sections according to the configured sequence.

#### Scenario: Configuration is unavailable
- **WHEN** the configuration endpoint fails or no configuration has been saved
- **THEN** the miniprogram falls back to the default sequence `recentActivities`, `todayTask`, `zaichang`, `myCheckins`, `xiaofanInsights`, `insightRequests`.

### Requirement: Horizontal Card Scroll Affordance
The miniprogram homepage SHALL size horizontal cards so adjacent hidden content is visible enough to suggest horizontal scrolling.

#### Scenario: Fanren life cards are displayed
- **WHEN** the `zaichang` section has multiple cards
- **THEN** the row shows approximately two full cards plus part of the third card in the visible viewport.

#### Scenario: My checkin cards are displayed
- **WHEN** the `myCheckins` section has multiple cards
- **THEN** the row shows approximately two full cards plus part of the third card in the visible viewport.
