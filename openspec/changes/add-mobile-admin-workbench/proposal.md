# Change: Add mobile admin workbench

## Why
Administrators need a phone-friendly first-phase workbench for quick operational lookup without opening the desktop admin console.

## What Changes
- Add read-only mini program administrator APIs for user search, enrollment/payment status lookup, and activity registration lists.
- Add a mobile admin workbench page in the mini program, linked from the administrator section on the profile page.
- Keep data mutation, batch operations, exports, refunds, and configuration changes in the desktop admin console.

## Impact
- Affected specs: `mobile-admin-workbench`
- Affected code: backend mobile admin routes/controllers, mini program profile/workbench page/service, focused tests.
