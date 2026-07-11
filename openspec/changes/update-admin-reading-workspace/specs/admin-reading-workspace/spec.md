## ADDED Requirements

### Requirement: Unified reading-workspace frame
The admin application SHALL present authenticated routes in a shared reading-workspace frame that visually continues the login page through a book-spine navigation area, chapter-style page heading, and neutral paper content surface.

#### Scenario: Administrator enters an authenticated route
- **WHEN** an authenticated administrator opens any admin route
- **THEN** the route content is rendered inside the shared reading-workspace frame
- **AND** the current navigation section and page title are visible as chapter metadata

### Requirement: Tenant-aware accent system
The admin application SHALL preserve a tenant's configured primary color while keeping paper, ink, and structural surfaces visually consistent across tenants.

#### Scenario: Administrator switches tenant
- **WHEN** the active tenant changes to a tenant with a valid primary color
- **THEN** actions, selected navigation, focus rings, and accent surfaces use derived values from that color
- **AND** paper backgrounds and primary text remain neutral and readable

#### Scenario: Tenant color is missing or invalid
- **WHEN** no valid tenant primary color is available
- **THEN** the application uses the default morning-reading green theme

### Requirement: Operational component consistency
The admin application SHALL apply shared visual rules to cards, filters, tables, pagination, dialogs, tabs, form controls, and status states without changing their business behavior.

#### Scenario: Administrator uses a business management page
- **WHEN** a route contains standard Element Plus operational components
- **THEN** those components inherit the shared reading-workspace tokens and spacing rules
- **AND** existing actions, permissions, filters, and data behavior remain unchanged

### Requirement: Responsive workspace integrity
The admin application SHALL keep navigation, page headings, controls, and content readable without incoherent overlap at supported desktop and narrow-screen widths.

#### Scenario: Viewport becomes narrow
- **WHEN** the viewport width is 860 pixels or less
- **THEN** navigation and header content reflow into the narrow-screen layout
- **AND** primary content remains reachable without being covered by navigation or header controls

