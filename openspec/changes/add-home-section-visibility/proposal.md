# Change: Add homepage section visibility controls

## Why
Administrators can reorder homepage sections, but cannot temporarily hide a section without removing code or data. Tenant operators need a safe toggle so hidden sections disappear from the miniprogram homepage while remaining manageable in the admin console.

## What Changes
- Add hidden/visible state for each supported homepage section.
- Let administrators toggle a section between hidden and visible on the homepage configuration page.
- Filter hidden sections from the public miniprogram homepage configuration response.
- Keep hidden sections visible in the admin response so operators can show them again.

## Impact
- Affected specs: homepage-config
- Affected code: backend home config model/controller/tests, admin home config view/API, miniprogram index page/tests
