# Change: Allow public Xiaofan insight shares to be viewed by all visitors

## Why

小凡看见详情的转发路径已经指向具体页面，但直接进入会被小程序社群权限守卫立即送回首页，公开信内容无法被查看。

## What Changes

- 公开小凡看见详情对未登录、已登录未参期和已参期访客开放浏览。
- 点赞、弹幕等互动仅对已登录且具备所属期次社群权限的用户开放；未登录或无权限时隐藏互动入口。
- 小凡看见分享路径继续直达详情页，不回落首页。

## Impact

- Affected specs: `insight-sharing`
- Affected code: `miniprogram/pages/insight-detail/insight-detail.js`、`miniprogram/pages/insight-detail/insight-detail.wxml`
- Tests: `miniprogram/__tests__/pages/insight-detail.spec.js`、`miniprogram/__tests__/design/social-direct-access.spec.js`
- Database: no schema or data changes
