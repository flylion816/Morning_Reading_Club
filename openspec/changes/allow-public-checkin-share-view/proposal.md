# Change: Allow public check-in shares to be viewed by all visitors

## Why

公开打卡分享链接对未登录访客可见，但已登录且未参加当前期次的好友会被期次权限校验拒绝。公开内容的查看规则应与访客是否登录或参加期次无关。

## What Changes

- 公开打卡详情对未登录、已登录未参期和已参期用户统一放行。
- 私密打卡继续拒绝未登录访客。
- 已登录用户查看私密打卡时继续执行原有期次社群权限校验。
- 小程序打卡详情模式不再依赖课程详情接口渲染公开打卡正文。
- 打卡评论区仅对已登录且具备所属期次社群权限的用户可见。

## Impact

- Affected specs: `checkin-sharing`
- Affected code: `backend/src/controllers/checkin.controller.js`、`backend/src/controllers/comment.controller.js`、`miniprogram/pages/course-detail/course-detail.js`
- Tests: `backend/tests/unit/controllers/checkin.controller.test.js`、`backend/tests/unit/controllers/comment.controller.test.js`、`miniprogram/__tests__/pages/course-detail.spec.js`
- Database: no schema or data changes
