## ADDED Requirements

### Requirement: Consistent user avatar source and fallback

The system SHALL treat `avatarUrl` as the only image source for a user record, treat a non-URL `avatar` value as fallback content, and use a name-character/default fallback when neither is available.

#### Scenario: User has an image avatar

- **WHEN** a user record has a non-empty `avatarUrl`
- **THEN** every user-facing avatar surface attempts to render that URL

#### Scenario: User has an emoji or text avatar without an image

- **WHEN** a user record has no usable `avatarUrl` and has a non-URL `avatar` value
- **THEN** the avatar renders the emoji or text inside the deterministic fallback background

#### Scenario: User has no avatar fields

- **WHEN** a user record has no usable image URL, no fallback avatar value, and no display name
- **THEN** the avatar renders the platform default fallback text and a deterministic background color

#### Scenario: Image URL fails to load

- **WHEN** an avatar image emits a load error
- **THEN** the avatar switches to the same fallback content without leaving a blank image or color-only block

### Requirement: Shared mini-program avatar component

The mini-program SHALL render user avatars through a reusable component that accepts size and shape presentation options, applies the canonical display contract, and preserves user ID click events.

#### Scenario: Interactive social avatar

- **WHEN** a user taps an avatar in a check-in, like, comment, insight, notification, or member surface
- **THEN** the existing page navigation receives the same user ID through the component event

#### Scenario: Same user appears in multiple mini-program surfaces

- **WHEN** the same user is rendered in two or more mini-program surfaces
- **THEN** the image/fallback decision, fallback text, and deterministic color are identical apart from the requested size or shape

### Requirement: Shared management backend avatar component

The management backend SHALL render member/user avatars through a reusable component and SHALL support administrator image URLs through an explicit image source without confusing them with the user emoji field.

#### Scenario: User avatar in a management table

- **WHEN** a management table renders a populated user record
- **THEN** it uses the shared component and the same user image/fallback contract as other management tables

#### Scenario: Administrator avatar

- **WHEN** the management layout or account page renders an administrator record
- **THEN** it passes the administrator image URL explicitly and uses the administrator name as fallback text

#### Scenario: Broken management avatar URL

- **WHEN** a management avatar image fails to load
- **THEN** the component displays its fallback text and deterministic color without an empty image frame

### Requirement: Avatar source regressions are covered

The project SHALL maintain focused tests and static checks that prevent a user `avatar` emoji/text from being used as an image source and cover representative social and management surfaces.

#### Scenario: Regression scan

- **WHEN** the avatar checks run against the migrated frontends
- **THEN** direct user `avatarUrl || avatar` image-source expressions are reported as violations

#### Scenario: Cross-surface fallback coverage

- **WHEN** the representative avatar tests run
- **THEN** image, emoji/text, empty, and broken-image fallback behavior is verified for both frontends
