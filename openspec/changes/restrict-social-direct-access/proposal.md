# Change: Restrict direct access to social pages

## Why

WeChat reviewers can discover page paths from the mini-program package and open social subpackage pages directly. Several pages performed asynchronous payment checks while their empty social shell remained visible, and some social detail pages did not perform an upfront paid-access check. This creates an incomplete review experience and exposes restricted social interfaces before authorization completes.

## What Changes

- Add a shared synchronous mini-program social-page guard based on a verified paid/free enrollment flag.
- Redirect unverified direct visitors immediately to the home tab before loading social data or rendering the social shell.
- Apply the guard to in-person, check-in, insight, member, ranking, other-user profile, activity, and legacy share social pages.
- Keep existing per-period and server-side authorization checks as the second layer.

## Impact

- Affected specs: `social-access-control`
- Affected code: `miniprogram/utils/social-access.js` and social page WXML/JS files
- No API, database, route, or payment logic changes.
