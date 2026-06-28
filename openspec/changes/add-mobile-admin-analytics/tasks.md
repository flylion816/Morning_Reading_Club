## 1. Proposal Approval
- [x] 1.1 Review and approve `proposal.md`, `design.md`, and spec delta before implementation.

## 2. Backend
- [x] 2.1 Add mobile admin authorization helper or middleware using mini program auth and administrator user roles.
- [x] 2.2 Add read-only mobile analytics routes under `/api/v1/mobile-admin/analytics`.
- [x] 2.3 Implement overview aggregation with date range and optional `periodId`.
- [x] 2.4 Split completed payment revenue into enrollment revenue and community activity revenue.
- [x] 2.5 Implement activity aggregation with today/yesterday summaries, trend series, and user detail rows.
- [x] 2.6 Ensure tenant isolation and invalid/inaccessible period handling.
- [x] 2.7 Add focused backend tests for admin success, non-admin 403, filter behavior, and revenue split.

## 3. Mini Program
- [x] 3.1 Add analytics API service wrapper.
- [x] 3.2 Add `admin-analytics` page to `app.json`.
- [x] 3.3 Add administrator-only entry in the profile page.
- [x] 3.4 Build mobile filters for date preset/range and period selection.
- [x] 3.5 Build business overview cards and mobile charts, preferring lightweight canvas/components over heavy chart dependencies.
- [x] 3.6 Build activity summary cards, trend chart, and user behavior detail list.
- [x] 3.7 Add loading, empty, error, and unauthorized states.
- [x] 3.8 Add focused mini program tests for visibility, filter calls, and render mapping.

## 4. Verification
- [x] 4.1 Run backend targeted tests.
- [x] 4.2 Run mini program targeted tests.
- [x] 4.3 Verify admin access, non-admin denial, date + period combined filtering, and phone display with isolated backend integration tests and mini program page tests.
- [x] 4.4 Confirm no database reset or initialization script was executed.
