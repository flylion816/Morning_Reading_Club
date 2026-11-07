## ADDED Requirements

### Requirement: 核心链路设计系统
小程序 SHALL provide shared design tokens and utility classes for core journey pages without adding a frontend framework.

#### Scenario: Core pages share visual language
- **WHEN** a user opens Home, Periods, Profile, Course Detail, Reading Mode, Enrollment, or Payment
- **THEN** the pages use consistent typography, surfaces, actions, and tenant primary-color tokens.

### Requirement: Core action feedback
Core journey pages SHALL provide visible pressed or selected feedback for primary interactive controls.

#### Scenario: User taps a primary control
- **WHEN** the user presses a course, form, payment, or primary action control
- **THEN** the control shows a non-blocking visual response and remains within its intended tap area.

### Requirement: Safe core form and payment actions
Enrollment and payment pages SHALL keep the primary action visible above the bottom safe area on long pages.

#### Scenario: Long enrollment form
- **WHEN** a tenant uses a full enrollment template with many required fields
- **THEN** the submit action remains fixed above the safe area and does not overlap the form content.
