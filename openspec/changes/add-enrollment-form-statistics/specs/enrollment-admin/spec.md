## ADDED Requirements

### Requirement: Enrollment Form Statistics Tab
The management admin SHALL provide a "报名信息统计" tab within enrollment management that lets admins choose a period and review aggregated enrollment form data plus individual submissions.

#### Scenario: Admin views statistics for a selected period
- **WHEN** an authenticated admin opens enrollment management and selects a period in the statistics tab
- **THEN** the system shows total submissions, gender counts with member names, age distribution, province distribution, reading history, commitment, payment status, referrer summary, text analysis for enrollment reasons and expectations, and a detail table of each submission

#### Scenario: Admin has not selected a period
- **WHEN** an authenticated admin opens the statistics tab without selecting a period
- **THEN** the system prompts the admin to choose a period before loading detailed statistics

### Requirement: Tenant-Scoped Enrollment Statistics API
The backend SHALL expose an admin-only, tenant-scoped endpoint that returns enrollment form statistics for an optional period filter without modifying enrollment data.

#### Scenario: Admin requests statistics for a period
- **WHEN** an authenticated admin requests enrollment form statistics with a valid periodId
- **THEN** the backend returns only non-deleted enrollments in the current tenant and selected period, including aggregate distributions and sanitized detail rows

#### Scenario: Admin provides invalid periodId
- **WHEN** an authenticated admin requests enrollment form statistics with an invalid periodId
- **THEN** the backend returns a 400 error and does not query enrollment data
