## ADDED Requirements
### Requirement: Rich Text Checkin Content
The system SHALL allow users to compose daily checkin notes with rich text formatting in the miniprogram checkin page.

#### Scenario: Compose formatted checkin
- **WHEN** a user applies bold, italic, underline, heading, list, or color formatting in the checkin editor
- **THEN** the editor preserves the formatted content for submission
- **AND** the submitted checkin includes both a plain-text note and sanitized rich-text HTML

#### Scenario: Paste formatted content
- **WHEN** a user pastes formatted content from another app into the checkin editor
- **THEN** supported formatting such as paragraphs, bold text, italic text, lists, and text color is preserved where the WeChat editor supports it
- **AND** unsupported or unsafe markup is removed before persistence

### Requirement: Rich Text Checkin Display Compatibility
The system SHALL display rich-text checkin content where available while preserving compatibility with historical plain-text checkins.

#### Scenario: Display rich text checkin
- **WHEN** a checkin has sanitized rich-text HTML
- **THEN** the course detail feed and checkin detail view render the HTML with the miniprogram rich-text renderer
- **AND** plain-text features such as search, sharing, and fold estimation continue to use the plain-text note

#### Scenario: Display historical plain text checkin
- **WHEN** a checkin does not have rich-text HTML
- **THEN** the course detail feed and checkin detail view display the existing plain-text note
