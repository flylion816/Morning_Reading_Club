## 1. Shared contract and utilities

- [x] 1.1 Extend `miniprogram/utils/avatar.js` with canonical source/text/color normalization and URL safety rules.
- [x] 1.2 Extend `admin/src/utils/avatar.ts` with the same user contract and explicit admin image-url handling.
- [x] 1.3 Add focused utility tests for both frontends, including malformed/failed image fallback cases.

## 2. Mini-program component and migration

- [x] 2.1 Add `miniprogram/components/user-avatar` with configurable size/shape, image-error fallback, and `avatarTap` event.
- [x] 2.2 Register the component and migrate the shared social surfaces: course check-ins, course-detail likes/comments/replies, insights, admin-section-insights, insight requests, seen-received, notifications, members, and ranking.
- [x] 2.3 Migrate profile, edit-profile, home, check-in records, activity/在场, buddy, invite, and keepsake avatar surfaces.
- [x] 2.4 Remove user-facing `avatarUrl || avatar` image-source fallbacks and duplicated avatar color/text decisions.
- [x] 2.5 Add/adjust mini-program page tests for representative image, emoji, empty, and broken-image states.

## 3. Management backend component and migration

- [x] 3.1 Add `admin/src/components/UserAvatar.vue` with explicit `imageUrl` support for admin accounts and user-record normalization for members.
- [x] 3.2 Migrate AdminLayout, Users, Enrollments, Dashboard, Payments, Completion Reports, Insights, Insight Requests, Letters, Activities, Periods, Imprints, Coupons, and admin account/profile avatars.
- [x] 3.3 Remove duplicated view-level avatar helpers and direct `el-avatar`/`img` source expressions where the shared component applies.
- [x] 3.4 Add/adjust admin Vitest coverage for the component and utility contract.

## 4. Verification

- [x] 4.1 Run targeted mini-program and admin avatar tests.
- [x] 4.2 Run static scans for mixed user `avatar`/`avatarUrl` source usage and resolve remaining violations.
- [ ] 4.3 Perform representative browser/device checks across mini-program and admin surfaces.
- [x] 4.4 Update reusable bug-fix documentation if a legacy avatar-source issue is confirmed.

> 4.3 remains open until the WeChat DevTools/real-device pass and an authenticated admin browser pass are available.
