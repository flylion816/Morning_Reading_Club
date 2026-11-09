## Context

`App.globalData.canUsePaidFeatures` is set only after the mini program verifies the user's enrollments from the backend. It is false on cold launch and for visitors without an active paid/free enrollment. Social pages can be opened directly from the registered page list, so each page must fail closed before its first render.

## Goals / Non-Goals

- Goals: block direct social-page entry before data requests or visible social UI; preserve existing period-specific checks for paid users.
- Non-Goals: replace server authorization; change payment rules; make all course content require login.

## Decisions

- Treat `canUsePaidFeatures !== true` as unverified and immediately call `wx.switchTab('/pages/index/index')`.
- Add `socialAccessGranted: false` to every protected page and gate its root WXML node.
- Run the guard as the first statement of `onLoad`, before service calls or tracking.
- Keep existing redirects after the synchronous guard for stale global state or period-specific denial.

## Risks / Trade-offs

- A paid user who cold-opens a social page directly will first return home while access is verified; this is intentional fail-closed behavior. Normal navigation from an initialized app remains unchanged.
