## 1. Backend Model And Validation
- [x] 1.1 Add `registrationForm` schema to `CommunityActivity`.
- [x] 1.2 Add `formSnapshot` and `formAnswers` schema to `ActivityRegistration`.
- [x] 1.3 Add shared helpers to validate form config and normalize submitted answers.
- [x] 1.4 Update activity create/update APIs to validate registration form fields, option ids, sort order, and stats eligibility.
- [x] 1.5 Update user activity detail API to return public form config and current user's registration answers.

## 2. Backend Registration Flow
- [x] 2.1 Update activity registration API to accept `formAnswers`.
- [x] 2.2 Validate required fields and field-type constraints before creating registration or payment.
- [x] 2.3 Persist form snapshot and normalized answers for free registrations.
- [x] 2.4 Persist/update form snapshot and normalized answers for paid pending registrations before returning payment payload.
- [x] 2.5 Ensure already completed free/paid registrations keep existing duplicate-registration behavior.

## 3. Backend Admin And Stats
- [x] 3.1 Extend PC admin registration list response with `formAnswers`.
- [x] 3.2 Extend mobile admin activity registration response with `formAnswers`.
- [x] 3.3 Add field-level stats for selectable/stat-enabled fields.
- [x] 3.4 Add detail lookup for a user's own activity registration or include enough detail in `myActivities`.
- [x] 3.5 Add focused backend tests for config validation, answer validation, free flow, stats, and validation boundaries.

## 4. PC Admin UI
- [x] 4.1 Add TypeScript-compatible local types/shapes for registration form fields and answers.
- [x] 4.2 Add registration form configuration section to `ActivitiesManagementView.vue`.
- [x] 4.3 Implement add/edit/delete/reorder field interactions and option editor.
- [x] 4.4 Include form config in create/update payloads and hydrate it in edit mode.
- [x] 4.5 Upgrade registration list UI to show answer chips, detail view, and field stats.
- [x] 4.6 Verify admin payload/UI changes with typecheck and production build.

## 5. Mini Program Registration UI
- [x] 5.1 Render registration form bottom sheet on `community-activity-detail`.
- [x] 5.2 Add field input components using native mini program controls.
- [x] 5.3 Validate required fields client-side before submit.
- [x] 5.4 Submit `formAnswers` with existing register request.
- [x] 5.5 Preserve existing free registration behavior and paid payment modal behavior after form submission.
- [x] 5.6 Show current user's submitted registration details on the activity detail page.

## 6. Mini Program Admin And My Activities UI
- [x] 6.1 Add `名单/统计` segmented control to `admin-activity-registrations`.
- [x] 6.2 Show answer chips on registration cards.
- [x] 6.3 Add bottom sheet for full registration answers and payment/order details.
- [x] 6.4 Render field stats and option-based people filtering.
- [x] 6.5 Add “查看报名信息” affordance to `my-community-activities`.
- [x] 6.6 Add focused mini program Jest tests for form rendering, submit payloads, mobile admin stats, and my activity detail display.

## 7. Verification
- [x] 7.1 Run relevant backend tests.
- [x] 7.2 Run admin typecheck/tests for touched files.
- [x] 7.3 Run mini program Jest tests for touched pages/services.
- [ ] 7.4 Manually verify free activity form报名, paid activity form报名+支付 pending, mobile admin名单/统计, and my activity detail.
