# Change: Add mobile admin analytics

## Why
Administrators need to review business and activity analytics inside the WeChat mini program without opening the desktop admin console. The mobile view must keep the same core data meaning as the admin analytics page while optimizing chart and detail layouts for phone screens.

## What Changes
- Add a mini program administrator analytics entry that is visible only to mini program users with administrator roles.
- Add read-only mobile administrator analytics APIs using mini program authentication and tenant isolation.
- Support combined filtering by date range and period.
- Show business overview metrics, enrollment/payment trends, revenue split between period enrollments and community activities, and key activity analytics.
- Show today and yesterday activity summaries, trend charts, and daily/user behavior details suitable for mobile screens.
- Display user phone numbers in behavior detail rows for administrators.

## Impact
- Affected specs: `mobile-admin-analytics`
- Affected backend code:
  - `backend/src/routes/*`
  - `backend/src/controllers/*`
  - `backend/src/models/UserActivity.js` query usage
  - `backend/src/app.js`
- Affected mini program code:
  - `miniprogram/app.json`
  - `miniprogram/pages/profile/*`
  - `miniprogram/pages/admin-analytics/*` (new)
  - `miniprogram/services/*` (analytics API wrapper)
- Tests:
  - Backend authorization and aggregation tests
  - Mini program page/service tests for admin visibility, filters, and rendering states
