## Context
The desktop admin analytics page currently combines data from `/api/v1/stats/*` and `/api/v1/activities/analytics`. Those endpoints require admin-console JWTs from the `Admin` model. The mini program uses user JWTs and recognizes administrator capability from `User.role` values such as `admin` and `super_admin`.

`UserActivity` already stores the activity events needed for mobile active-user analytics, including app opens, course views, check-ins, insight views, meeting entries, comments, likes, and other engagement actions.

## Goals / Non-Goals
- Goals:
  - Provide a mobile-first read-only analytics page for administrators in the mini program.
  - Preserve tenant isolation and mini program authentication.
  - Support date range and period filters together.
  - Show business and activity analytics with charts and readable mobile detail lists.
  - Split revenue by period enrollment payments and community activity payments.
- Non-Goals:
  - No admin-console password login inside the mini program.
  - No export, destructive operation, database initialization, or data mutation.
  - No full desktop table parity where it harms phone usability.

## Decisions
- Decision: Add mobile-specific analytics endpoints rather than reusing desktop admin endpoints directly.
  - Reason: Desktop endpoints use `Admin` authentication. Mobile administrators already authenticate as mini program users, so sharing endpoints would blur auth boundaries.
- Decision: Authorize via `authMiddleware`, `userTenantContext`, and an explicit user role check.
  - Reason: This matches existing mini program admin features such as section insight review.
- Decision: Use a compact mobile API response that returns summary cards, chart series, and detail rows in one or two calls.
  - Reason: Mini program pages benefit from fewer network round trips and simpler loading states.
- Decision: Use server-side aggregation for date and period filtering.
  - Reason: Filtering analytics client-side would leak unnecessary rows and increase payload size.

## API Shape
Suggested endpoints:

```text
GET /api/v1/mobile-admin/analytics/overview
GET /api/v1/mobile-admin/analytics/activity
```

Common query:

```text
startDate=YYYY-MM-DD
endDate=YYYY-MM-DD
periodId=<optional ObjectId>
```

Overview response:

```js
{
  filters: { startDate, endDate, periodId },
  summary: {
    totalUsers,
    totalEnrollments,
    paidEnrollments,
    enrollmentRevenue,
    activityRevenue,
    totalRevenue,
    conversionRate
  },
  enrollmentTrend: [{ date, enrollmentCount, paidEnrollmentCount }],
  paymentTrend: [{ date, enrollmentAmount, activityAmount, totalAmount, paymentCount }],
  periodPopularity: [{ periodId, periodName, enrollmentCount, paidEnrollmentCount }],
  paymentMethodDistribution: [{ method, count, amount }]
}
```

Activity response:

```js
{
  filters: { startDate, endDate, periodId },
  summary: {
    today: { appOpenUsers, checkinUsers, insightViewUsers, activeUsers },
    yesterday: { appOpenUsers, checkinUsers, insightViewUsers, activeUsers },
    delta: { appOpenUsers, checkinUsers, insightViewUsers, activeUsers }
  },
  actionLabels: { app_open: '访问小程序', ... },
  trend: [
    {
      date,
      activeUserCount,
      app_open,
      checkin_submit,
      own_insight_view,
      other_insight_view,
      course_view,
      meeting_enter
    }
  ],
  details: [
    {
      date,
      userId,
      nickname,
      phone,
      actions: [{ action, label, count }],
      totalCount,
      lastOccurredAt
    }
  ]
}
```

## Filtering Semantics
- Date range defaults to the last 30 Shanghai calendar days.
- `today` and `yesterday` use Shanghai calendar dates, independent of the selected custom range.
- When `periodId` is present:
  - Enrollment and period revenue metrics filter by that period.
  - Activity metrics filter `UserActivity.periodId` where available.
  - Activity rows without `periodId` are excluded from period-specific activity charts.
- When `periodId` is absent:
  - Overview metrics use all periods and include community activity revenue.
  - Activity metrics use all tracked activity rows in the tenant.

## Mobile UI
- Entry: profile page settings group, visible only to administrator users.
- Page: `admin-analytics`, with tabs for `业务概览` and `活跃度`.
- Filters:
  - Segmented date presets: 今日, 昨日, 近7天, 近30天.
  - Date range picker where supported by existing mini program patterns.
  - Period selector with `全部期次` plus available periods.
- Charts:
  - Use compact phone-friendly line/bar charts.
  - Show at most the key series by default; allow toggling activity series if needed.
  - Horizontal scroll is acceptable for dense trend charts.
- Detail rows:
  - Replace desktop tables with stacked cards or a compact list.
  - Show nickname, phone, total count, last action time, and action chips.

## Privacy / Security
- Phone numbers are displayed only after administrator authorization passes.
- Endpoints are read-only and must not expose records across tenants.
- Non-admin users must receive 403.
- Invalid `periodId` or an inaccessible period must return a clear 400/404 response.

## Risks / Trade-offs
- Some activity events may not have `periodId`, so period-specific activity can be lower than all-tenant activity.
  - Mitigation: Document the period-specific activity as based on events with bound `periodId`.
- Chart libraries can increase mini program package size.
  - Mitigation: Prefer an existing chart dependency if present; otherwise use lightweight canvas charts or a small reusable component.
- Phone display increases sensitivity.
  - Mitigation: Keep the page admin-only and avoid caching detail payloads in persistent storage.
