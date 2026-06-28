## ADDED Requirements
### Requirement: Mobile Admin Analytics Access
The system SHALL provide a mini program analytics page that is visible and accessible only to authenticated administrator users.

#### Scenario: Administrator sees analytics entry
- **GIVEN** the mini program user is logged in with an administrator role
- **WHEN** the user opens the profile page
- **THEN** the system displays a data analytics entry

#### Scenario: Non-administrator cannot access analytics
- **GIVEN** the mini program user is logged in without an administrator role
- **WHEN** the user requests a mobile administrator analytics endpoint
- **THEN** the system returns a forbidden response

### Requirement: Combined Date And Period Filtering
The system SHALL support analytics filtering by date range and optional period at the same time.

#### Scenario: Filter by date range and period
- **GIVEN** an administrator selects a date range and a period
- **WHEN** the analytics page loads data
- **THEN** the system returns metrics constrained by both the selected date range and selected period

#### Scenario: Filter all periods by date range
- **GIVEN** an administrator selects a date range and no specific period
- **WHEN** the analytics page loads data
- **THEN** the system returns tenant-wide metrics for the selected date range

### Requirement: Mobile Business Overview
The system SHALL show business overview metrics and charts in a phone-friendly layout.

#### Scenario: View overview summary
- **GIVEN** an administrator opens the business overview tab
- **WHEN** analytics data loads successfully
- **THEN** the system shows total users, total enrollments, paid enrollments, enrollment revenue, activity revenue, total revenue, and payment conversion rate

#### Scenario: View overview charts
- **GIVEN** overview data contains daily trend rows
- **WHEN** the administrator views the overview tab
- **THEN** the system shows mobile-readable enrollment and payment trend charts

### Requirement: Revenue Source Split
The system SHALL distinguish period enrollment revenue from community activity revenue while also showing total revenue.

#### Scenario: Revenue split includes both sources
- **GIVEN** completed payments exist for period enrollments and community activities
- **WHEN** the overview analytics are requested
- **THEN** the system returns separate enrollment revenue, activity revenue, and combined total revenue values

### Requirement: Mobile Activity Analytics
The system SHALL show mobile activity analytics using existing user activity events.

#### Scenario: View activity summary
- **GIVEN** activity events exist for today and yesterday
- **WHEN** an administrator opens the activity tab
- **THEN** the system shows today values, yesterday values, and deltas for app opens, check-ins, insight views, and active users

#### Scenario: View activity trend chart
- **GIVEN** activity events exist in the selected range
- **WHEN** the administrator views the activity tab
- **THEN** the system shows a mobile-readable trend chart for key actions including app open, check-in, own insight view, other insight view, course view, and meeting entry

### Requirement: Mobile Activity User Details
The system SHALL show per-user behavior detail rows for administrator review.

#### Scenario: View user behavior details
- **GIVEN** user activity events exist for the selected filters
- **WHEN** the administrator views behavior details
- **THEN** the system shows each user's date, nickname, phone, action chips with counts, total action count, and latest action time

#### Scenario: Empty behavior details
- **GIVEN** no user activity events exist for the selected filters
- **WHEN** the administrator views behavior details
- **THEN** the system shows an empty state instead of a blank list

### Requirement: Read-Only Analytics Safety
The system SHALL keep all mobile administrator analytics capabilities read-only and tenant isolated.

#### Scenario: Analytics request does not mutate data
- **GIVEN** an administrator requests mobile analytics
- **WHEN** the request completes
- **THEN** the system does not create, update, delete, initialize, reset, or overwrite business data

#### Scenario: Tenant isolation is enforced
- **GIVEN** analytics data exists in multiple tenants
- **WHEN** an administrator requests mobile analytics for their tenant
- **THEN** the system returns only analytics data belonging to the resolved tenant context
