## 1. Tests

- [x] 1.1 Add a regression test for a logged-in non-enrolled viewer opening a public check-in.
- [x] 1.2 Cover anonymous and authenticated access boundaries for private check-ins.

## 2. Implementation

- [x] 2.1 Bypass period community access checks for public check-in details.
- [x] 2.2 Preserve existing private check-in authorization behavior.

## 3. Verification

- [x] 3.1 Cover anonymous public check-in detail rendering without a course request.
- [x] 3.2 Cover locked comments for visitors without community access.
- [x] 3.3 Cover backend comment-list community access authorization.
- [x] 3.4 Run focused mini-program and comment-controller tests.
- [x] 3.5 Validate this OpenSpec change in strict mode.

## 4. Follow-up Implementation

- [x] 4.1 Load public check-in details from the check-in API without fetching course content.
- [x] 4.2 Lock check-in comments until login and period community access are verified.
- [x] 4.3 Enforce period community access in the backend comment-list endpoint.
