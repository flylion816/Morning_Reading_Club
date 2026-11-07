## ADDED Requirements

### Requirement: Remaining pages share the core visual language
The miniprogram SHALL apply the shared warm-paper background, tenant theme, spacing, radius, and shadow language to remaining package pages.

#### Scenario: User moves from core journey to package pages
- **WHEN** the user opens checkin, insight, activity, notification, report, podcast, or mobile admin pages
- **THEN** the page visually belongs to the same product without changing its existing business flow.

### Requirement: Consistent feedback and safe areas
Remaining interactive pages SHALL provide clear pressed feedback and keep fixed actions above the bottom safe area where applicable.

#### Scenario: User opens a long package page
- **WHEN** a page has a fixed action, FAB, player, or bottom operation
- **THEN** it does not overlap the system home indicator and provides visible touch feedback.

### Requirement: Paged insight lists
The miniprogram SHALL load personal and authorized-other insight lists in bounded pages instead of waiting for every authorized record.

#### Scenario: User opens the insights page
- **WHEN** the user opens My Insights or switches to Others' Insights
- **THEN** the first bounded page renders before older or additional authorized records are fetched.

#### Scenario: User reaches the end of the loaded list
- **WHEN** more server pages remain available
- **THEN** the app appends the next bounded page once and preserves already loaded items without duplication.
