## Context

User records have two different fields with different meanings:

- `avatarUrl`: an image URL for a WeChat/user avatar.
- `avatar`: a short emoji or text avatar, with values such as `🦁` or a single Chinese character.

Admin records use `Admin.avatar` as an image URL. Existing views mix these meanings and each page implements a different fallback.

## Goals / Non-Goals

- Goals: one display contract, one fallback order, one deterministic color rule per frontend, image-error recovery, consistent sizes/shapes, and preserved avatar click behavior.
- Non-Goals: changing user data, changing the upload API, converting old avatar values, adding a remote avatar service, or redesigning every page around a new layout.

## Decisions

### 1. Canonical display contract

A user avatar is resolved in this order:

1. Use a non-empty `avatarUrl` as the image source.
2. If the image is missing or emits an error, use a non-URL `avatar` value as the fallback content.
3. If no fallback content exists, use the last visible character of the display name.
4. If the display name is empty, use the platform default fallback (`用` for user-facing Chinese UI).
5. Derive the fallback background color from a stable user ID, with the current tenant/admin theme as the first palette color.

The `avatar` field is never implicitly passed to an image `src` for a user record. Admin image URLs are passed explicitly through the admin component's `imageUrl` prop.

### 2. Mini-program component

Add `miniprogram/components/user-avatar` with properties for `avatarUrl`, `avatarText`, `avatarColor`, `size`, `shape`, and `userId`. The component owns image-error fallback and emits a dedicated `avatarTap` event with the user ID. Callers may continue to wrap it in page-specific navigation handlers.

`miniprogram/utils/avatar.js` remains the normalization entry point. Existing page loaders should call its decorator instead of reimplementing source, text, or color decisions.

### 3. Admin component

Add `admin/src/components/UserAvatar.vue` backed by `admin/src/utils/avatar.ts`. The component accepts a user record or explicit `imageUrl`, renders Element Plus avatar content, handles image errors, and applies the shared admin fallback text/color. Admin account records use the explicit `imageUrl` path because their `avatar` field is already an image URL.

### 4. Migration order

Migrate the shared helpers first, then the mini-program component and high-traffic social surfaces, then the admin component and user-facing management tables. Remove direct `avatarUrl || avatar` image expressions and duplicated per-view fallback functions as each surface moves.

### 5. Compatibility and rollback

The change is presentation-only. Existing API response shapes remain valid. A rollback can restore the previous page templates and helpers without touching stored data.

## Risks / Trade-offs

- Some legacy records may contain malformed URLs -> the component's image error handler falls back to text and prevents a blank/colored block.
- Emoji glyphs differ by platform -> keep emoji as an intentional fallback and ensure the name-character fallback remains available.
- Migrating interactive avatars can change event wiring -> preserve the existing user ID payload and verify navigation on representative social pages.
- Reusing one component across very different sizes may over-standardize layouts -> expose size and shape props while keeping source/fallback logic centralized.

## Verification Plan

- Unit coverage for URL/source selection, emoji/text fallback, empty user fallback, stable color, and image error state.
- Static scan for user-facing `avatarUrl || avatar` image expressions after migration.
- Targeted page checks for check-in, course-detail likes/comments, insights, admin-section-insights, members, notifications, and admin tables.
- Browser/device visual checks for one image avatar, one emoji avatar, one name-character avatar, and one broken image URL.
