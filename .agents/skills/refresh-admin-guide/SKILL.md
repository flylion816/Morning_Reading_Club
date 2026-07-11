---
name: refresh-admin-guide
description: Use when updating or troubleshooting this project's administrator guide after admin UI, tenant branding, menu, content, screenshot, or responsive-layout changes.
---

# 更新管理员指南

## Scope

Refresh the shared guide at `docs/admin-guide/fanren-reading-admin-guide.html` and its tenant-specific screenshots under `docs/admin-guide-assets/<slug>/` for `fanren` and `starry`.

Keep one guide implementation. Select branding and screenshots from the URL `slug`; do not fork the HTML into tenant-specific copies.

## Safety Rules

- Work from the repository root and follow `AGENTS.md`.
- Preserve unrelated and pre-existing changes in a dirty worktree.
- Never run `backend/scripts/init-mongodb.js`, any `init-*.js`, or any database reset, clear, or overwrite command.
- Do not expose admin credentials, tokens, phone numbers, payment records, report data, IP addresses, audit details, or user-authored narratives.
- Do not commit, push, deploy, or alter production data before the user explicitly confirms the preview.
- Read each tenant's `primaryColor` from `miniprogram/config/tenants/<slug>.js`. Never infer a color from screenshots, tenant names, or another tenant.

## Workflow

### 1. Establish the baseline

1. Run the session cleanup and Git status checks required by `AGENTS.md`.
2. Read the guide's `assetVersion` value. Interpret `YYYYMMDD-HHMM` as the last guide refresh time.
3. Review admin changes since that time with Git history and diffs. Also inspect current uncommitted admin changes.
4. Read `admin/src/router/index.ts`, the affected views/components, and [references/screenshot-map.md](references/screenshot-map.md).
5. Confirm the current source-of-truth colors:

```bash
node - <<'NODE'
for (const slug of ['fanren', 'starry']) {
  const tenant = require(`./miniprogram/config/tenants/${slug}.js`);
  console.log(slug, tenant.primaryColor);
}
NODE
```

### 2. Update guide content

- Keep menu names, section order, button labels, permissions, empty states, warnings, and operating steps aligned with the current admin UI.
- Add or remove sections and screenshots together; update navigation, quick-reference tables, captions, `alt` text, and the screenshot map in the same change.
- Keep `data-shot` as the stable screenshot filename and let the guide's script prepend the selected tenant asset directory.
- Set the root tenant data attribute from the validated screenshot slug so CSS theme and images cannot diverge.
- Keep `fanren` as the fallback for missing or unsupported slugs.
- Refresh social preview image URLs and the visible update month when appropriate.

### 3. Capture tenant screenshots

Use an authenticated local or approved admin preview. Capture every row in [references/screenshot-map.md](references/screenshot-map.md) for both tenants.

- Desktop viewport: `1512x771`.
- Output: PNG at exactly `1512x771`.
- Select the intended tenant before capture and confirm the visible brand/theme.
- Complete the required tab, filter, dialog, or detail interaction listed in the map.
- Keep annotation placement consistent between tenants and avoid covering controls that the guide explains.
- Mask names, avatars when identifying, phone numbers, order/payment details, report filenames/content, IP addresses, audit actors/details, application text, and user-authored narratives.
- Real empty states are acceptable. Never copy one tenant's data screenshot into the other tenant's directory.

Inspect every final PNG visually at full size. A filename containing `unmasked` does not exempt it from the privacy rules.

### 4. Refresh cache version

After all HTML and PNG changes are final, generate one cache version:

```bash
date '+%Y%m%d-%H%M'
```

Use that same value for `assetVersion` and all hardcoded social-preview image URLs. Do not invent a future timestamp.

### 5. Verify desktop and mobile

Serve the repository locally and check both URLs:

```text
/docs/admin-guide/fanren-reading-admin-guide.html?slug=fanren
/docs/admin-guide/fanren-reading-admin-guide.html?slug=starry
```

At desktop size, verify tenant color, tenant screenshots, annotation readability, navigation, and zero broken images.

At both `390x844` and `320x568`, verify:

- `document.body.scrollWidth === window.innerWidth`;
- the compact section selector is visible and moves to the selected section;
- desktop navigation groups are hidden;
- tables and screenshots scroll horizontally only inside their frames;
- screenshots stay readable and do not shrink into illegible thumbnails;
- headings, controls, and captions do not overlap;
- all images finish loading with `naturalWidth > 0`.

### 6. Run deterministic checks

```bash
node --test tests/admin-guide-theme-responsive.test.mjs
node .agents/skills/refresh-admin-guide/scripts/audit-admin-guide.mjs
git diff --check
```

Do not report completion until all three pass and both tenant URLs have been visually checked at desktop and both mobile viewports. Report modified files and preview URLs, then wait for user confirmation before any Git or deployment action.

## Audit Limits

The audit script verifies configuration agreement, screenshot references, file presence and PNG dimensions, cache format, and responsive hooks. It cannot judge whether private pixels are adequately masked or whether annotations point at the correct controls. Those remain mandatory visual checks.
