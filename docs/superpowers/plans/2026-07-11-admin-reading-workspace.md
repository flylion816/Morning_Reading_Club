# Admin Reading Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every authenticated admin route visually continue the morning-reading login experience while preserving tenant brand colors and existing behavior.

**Architecture:** Keep business views intact and concentrate the redesign in the shared `AdminLayout`, global design tokens, and Element Plus overrides. Extend the existing tenant color derivation rather than creating tenant-specific stylesheets.

**Tech Stack:** Vue 3, TypeScript, Pinia, Element Plus, Vitest, Vite

---

### Task 1: Lock the workspace contract

**Files:**
- Modify: `admin/src/components/__tests__/AdminLayout.spec.ts`
- Modify: `admin/src/stores/__tests__/tenant.spec.ts`

- [ ] Add a failing layout test asserting `.reading-workspace`, `.workspace-paper`, and route chapter metadata exist.
- [ ] Run `npm --prefix admin test -- --run src/components/__tests__/AdminLayout.spec.ts` and confirm the new assertion fails because the structure is absent.
- [ ] Add or retain tenant tests proving valid colors are derived and invalid colors fall back safely.

### Task 2: Implement shared reading-workspace structure

**Files:**
- Modify: `admin/src/components/AdminLayout.vue`
- Modify: `admin/src/assets/base.css`
- Modify: `admin/src/assets/main.css`

- [ ] Add computed section metadata from the existing menu groups and render a compact chapter eyebrow above the route title.
- [ ] Wrap route content in `.reading-workspace > .workspace-paper` without changing slot behavior.
- [ ] Add paper, divider, surface, density, and responsive tokens while retaining tenant-derived accent tokens.
- [ ] Restyle shared Element Plus components using tokens and keep operational controls at 8px radius or less.
- [ ] Run the targeted layout and tenant tests until green.

### Task 3: Remove local style conflicts

**Files:**
- Modify only affected files under `admin/src/views/*.vue`

- [ ] Search for hard-coded blue, green, gray, radius, and surface values that conflict with shared tokens.
- [ ] Replace only visible conflicts with `--admin-*` variables; do not alter semantic chart colors, rich content previews, or business logic.
- [ ] Run `npm --prefix admin test -- --run` and fix regressions.

### Task 4: Verify rendering and responsive behavior

**Files:**
- Create: `design-qa.md`
- Create: `tmp/admin-reading-workspace/*.png` (verification artifacts only, do not commit)

- [ ] Run `npm --prefix admin run build` and require exit code 0.
- [ ] Start the local admin and capture login plus authenticated representative routes at desktop and narrow widths.
- [ ] Compare reference and implementation, fix every P0/P1/P2 mismatch, and record `final result: passed` in `design-qa.md`.
- [ ] Run `graphify update .` after code changes.

### Task 5: Release

**Files:**
- Modify: `openspec/changes/update-admin-reading-workspace/tasks.md`

- [ ] Mark only completed OpenSpec tasks checked.
- [ ] Review `git diff`, exclude `tmp/` and unrelated files, and ensure no secret or reset script is staged.
- [ ] Commit with a concise `feat:` message and push `main` using the configured GitHub token flow.
- [ ] Run `bash scripts/deploy-to-server-optimized.sh`.
- [ ] Verify `https://wx.shubai01.com/admin` and representative authenticated routes from production.

