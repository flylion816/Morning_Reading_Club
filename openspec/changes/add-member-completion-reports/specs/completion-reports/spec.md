## ADDED Requirements

### Requirement: Admin Uploads Member Completion Reports
The system SHALL allow an authenticated administrator to attach one PDF completion report to a specific enrollment in a specific period.

#### Scenario: Upload PDF for a member
- **GIVEN** an administrator is authenticated in a tenant
- **AND** a member has an enrollment in that tenant
- **WHEN** the administrator uploads and attaches a PDF to that enrollment
- **THEN** the enrollment stores the report file URL, file name, file size, MIME type, uploader, and upload time
- **AND** other members in the same period are not changed

#### Scenario: Reject non-PDF report
- **GIVEN** an administrator is authenticated
- **WHEN** the administrator attempts to attach a non-PDF file as a completion report
- **THEN** the system rejects the request with a validation error

#### Scenario: Replace existing PDF
- **GIVEN** an enrollment already has a completion report
- **WHEN** the administrator confirms replacement with a new PDF
- **THEN** the enrollment stores the new report metadata
- **AND** the user sees the new report in the miniprogram

#### Scenario: Clear report
- **GIVEN** an enrollment has a completion report
- **WHEN** the administrator clears the report
- **THEN** the enrollment no longer has report metadata
- **AND** the user no longer sees a usable PDF action for that period

### Requirement: Admin Manages Reports By Period Member
The system SHALL provide a management view that lists period members and their completion report upload status.

#### Scenario: Filter reports by period
- **GIVEN** an administrator opens the report management page
- **WHEN** the administrator selects a period
- **THEN** the system shows enrolled members for that period with nickname, enrollment name, phone, payment status, and report status

#### Scenario: Show missing reports
- **GIVEN** an administrator opens the report management page
- **WHEN** the administrator enables the missing-report filter
- **THEN** the system shows only enrollments without an attached completion report

### Requirement: User Views Own Completion Reports
The system SHALL allow an authenticated user to view only completion reports attached to their own paid or free enrollments.

#### Scenario: User opens their report list
- **GIVEN** a user is authenticated
- **WHEN** the user opens "我的实录报告"
- **THEN** the system lists reports for that user's eligible enrollments
- **AND** each report title uses "成员昵称分享实录"

#### Scenario: Report is still being prepared
- **GIVEN** a user has an eligible enrollment without an uploaded report
- **WHEN** the user opens "我的实录报告"
- **THEN** the system shows that period as "报告整理中"
- **AND** does not show PDF preview or share actions for that period

#### Scenario: User cannot view another member report
- **GIVEN** a user is authenticated
- **WHEN** the user requests a report for another user's enrollment
- **THEN** the system does not return that report

#### Scenario: Unpaid enrollment is excluded
- **GIVEN** a user has an enrollment with payment status pending or refunded
- **WHEN** the user opens "我的实录报告"
- **THEN** the system does not include that enrollment report

### Requirement: Miniprogram Opens And Shares PDF Reports
The miniprogram SHALL support PDF preview and WeChat file sharing for an uploaded completion report.

#### Scenario: Open PDF
- **GIVEN** a user has a completion report
- **WHEN** the user taps "查看 PDF"
- **THEN** the miniprogram downloads the PDF and opens it with the WeChat document viewer

#### Scenario: Share PDF
- **GIVEN** a user has opened a completion report detail
- **WHEN** the user taps "分享到微信"
- **THEN** the miniprogram shares the PDF file when the runtime supports file sharing
- **AND** provides a preview-menu or copy-link fallback when direct file sharing is unavailable

#### Scenario: PDF download fails before preview
- **GIVEN** a user has a report detail with a file URL
- **WHEN** the miniprogram cannot retrieve the PDF temporary file
- **THEN** it shows a retryable error
- **AND** keeps the copy-link fallback available

### Requirement: Homepage Report Shortcut
The miniprogram SHALL show a "看实录" shortcut on today's task when the current user has a report for the task's period.

#### Scenario: Report exists for current period
- **GIVEN** today's task belongs to a period where the user has an uploaded report
- **WHEN** the homepage renders today's task
- **THEN** the task action area includes a "看实录" button
- **AND** tapping it opens the report detail for that period

#### Scenario: Report missing for current period
- **GIVEN** today's task belongs to a period where the user has no uploaded report
- **WHEN** the homepage renders today's task
- **THEN** the task action area does not show "看实录"
