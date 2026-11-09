## ADDED Requirements

### Requirement: Direct social page access
The mini program SHALL prevent an unverified visitor from rendering or loading a restricted social page when the page is opened directly.

#### Scenario: Direct visit without a verified enrollment
- **GIVEN** the app has not verified an active paid or free enrollment
- **WHEN** the visitor opens a restricted social page path directly
- **THEN** the page immediately redirects to the home tab before loading social data or rendering its social shell

#### Scenario: Verified social member
- **GIVEN** `canUsePaidFeatures` is true after backend enrollment verification
- **WHEN** the member opens a restricted social page
- **THEN** the page shell unlocks and existing period-specific authorization continues to run
