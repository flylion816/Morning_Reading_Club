## Context

`Enrollment` already supports `withdrawn` status and the user-side withdrawal flow. The admin list only exposes soft deletion, which hides the record and is unsuitable when operators need to preserve test evidence or repeatedly test enrollment.

## Goals / Non-Goals

- Goals: let authenticated tenant administrators cancel active enrollments while preserving the record; make cancelled state visible.
- Non-Goals: refund payments, cancel Payment records, modify historical form answers, or allow cancelling completed/withdrawn enrollments.

## Decisions

- Use a dedicated `POST /enrollments/:id/cancel` route instead of widening the generic update whitelist.
- Reuse the model's `withdraw()` method so `status` and `withdrawnAt` stay consistent.
- Keep `paymentStatus` unchanged; cancelled paid records retain payment evidence.
- The endpoint is tenant-scoped and returns 400 when the enrollment is not active.

## Risks / Trade-offs

- Cancelling immediately revokes social/community access because active/completed enrollment is required. This is intentional for testing.
- A cancelled record can later be reused by the existing user enrollment resubmission flow.
