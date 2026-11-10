# Change: Add administrator enrollment cancellation

## Why

Administrators can soft-delete an enrollment, but deletion is too destructive for repeated permission testing. A cancellation should preserve the original enrollment, form answers, and payment evidence while immediately revoking active period access.

## What Changes

- Add an authenticated administrator endpoint to cancel an active enrollment.
- Set enrollment status to `withdrawn` and record `withdrawnAt`.
- Decrease the period enrollment count and publish the existing MySQL sync event.
- Add a “取消报名” action in the admin enrollment table for active enrollments.
- Show enrollment status so cancelled records are distinguishable from active records.

## Impact

- Affected specs: `enrollment-management`
- Affected code: `backend/src/controllers/enrollment.controller.js`, `backend/src/routes/enrollment.routes.js`, `admin/src/services/api.ts`, `admin/src/views/EnrollmentsView.vue`
- No database schema change and no automatic payment refund.
