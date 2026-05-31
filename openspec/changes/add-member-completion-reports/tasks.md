## 1. Backend
- [x] 1.1 Extend `Enrollment` with `completionReport` metadata fields.
- [x] 1.2 Add admin report list/update/delete controllers with tenant and PDF validation.
- [x] 1.3 Implement report title builder using user nickname, enrollment name, then fallback.
- [x] 1.4 Add user report list/detail controllers scoped to the current user and paid/free enrollments.
- [x] 1.5 Register routes before parameterized enrollment routes.
- [x] 1.6 Add focused backend tests for permissions, missing report, wrong user, unpaid enrollment, tenant isolation, and PDF-only validation.

## 2. Admin
- [x] 2.1 Add report APIs to `admin/src/services/api.ts`.
- [x] 2.2 Add `CompletionReportsManagementView.vue`.
- [x] 2.3 Add router and sidebar entry.
- [x] 2.4 Implement period/search filters, only-missing filter, upload/replace/delete actions, preview/copy-link, and report status display.
- [x] 2.5 Add replace and clear confirmation flows.
- [x] 2.6 Add targeted Vitest coverage for API wiring and upload validation.

## 3. Miniprogram
- [x] 3.1 Add `completion-report.service.js`.
- [x] 3.2 Add report list page and detail page to `app.json`.
- [x] 3.3 Add “我的实录报告” entry in profile page.
- [x] 3.4 Add homepage “看实录” button when current period has a report.
- [x] 3.5 Implement PDF preview, WeChat file sharing when available, and preview-menu/copy-link fallback.
- [x] 3.6 Add report loading, empty, organizing, forbidden/not-found, and retry states.
- [x] 3.7 Add focused Jest tests for profile entry, homepage button visibility, report list, and detail actions.

## 4. Verification
- [x] 4.1 Verify admin can upload a PDF for one member without affecting other members.
- [x] 4.2 Verify a user can only see their own report.
- [ ] 4.3 Verify report preview works in WeChat DevTools and on a real device.
- [x] 4.4 Verify unsupported share-file environments still allow PDF preview menu sharing or link copy.
- [x] 4.5 Verify no database reset or initialization scripts are executed.
