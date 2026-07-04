## ADDED Requirements
### Requirement: Admin Configurable Homepage Section Visibility
The system SHALL let an authenticated administrator mark any supported homepage section as hidden or visible without losing its configured order.

#### Scenario: Administrator hides a section
- **WHEN** an administrator marks a supported homepage section as hidden and saves the homepage configuration
- **THEN** the section remains in the admin configuration list with hidden status.

#### Scenario: Administrator shows a hidden section
- **WHEN** an administrator marks a hidden homepage section as visible and saves the homepage configuration
- **THEN** the section remains in its configured order and becomes visible again.

#### Scenario: Administrator restores defaults
- **WHEN** an administrator restores the default homepage configuration
- **THEN** all supported homepage sections are visible in the default order before saving.

### Requirement: Public Homepage Omits Hidden Sections
The public miniprogram homepage configuration response SHALL omit hidden homepage sections.

#### Scenario: Public config contains hidden sections
- **WHEN** a tenant homepage configuration has one or more hidden sections
- **THEN** the public homepage configuration response includes only visible sections in their configured order.

#### Scenario: Existing config has no hidden state
- **WHEN** a tenant homepage configuration was created before section visibility existed
- **THEN** every supported homepage section is treated as visible.
