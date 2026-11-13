# Change: 统一全端头像展示与回退逻辑

## Why
小程序和管理后台目前分别维护多套头像判断、颜色和占位样式。部分页面把用户的 `avatar`（emoji/文字）误当成图片地址，导致头像加载失败后只显示颜色块；另一些页面没有处理图片加载失败，或使用不同的首字、颜色和圆角规则。打卡、点赞、评论、小凡看见、成员、通知和管理后台中的同一用户因此可能显示成不同头像。

## What Changes
- 定义统一的用户头像展示契约：`avatarUrl` 只作为用户图片地址，`avatar` 作为 emoji/文字回退内容。
- 在小程序新增公共头像组件和统一展示工具，覆盖图片、emoji/文字、默认回退、稳定颜色、图片加载失败和点击事件。
- 在管理后台新增公共头像组件和统一展示工具，覆盖用户头像和管理员头像；管理员的图片字段通过显式图片地址传入，不与小程序用户的 `avatar` 语义混用。
- 迁移打卡、点赞、评论/回复、小凡看见、查看申请、成员、排行、通知、个人资料、在场、活动、纪念册等小程序头像入口。
- 迁移用户、报名、支付、仪表板、实录报告、小凡看见、活动、期次、慢递邮局、在场、优惠券和后台账户/顶部管理员头像入口。
- 为图片加载失败、空用户、无图片但有 emoji/文字、无任何头像字段等场景补充可验证的回退行为。
- 保持现有接口、权限、数据库字段和头像上传流程不变，不执行任何数据库迁移或初始化。

## Impact
- Affected specs: `avatar-display`
- Affected code: `miniprogram/utils/avatar.js`, `miniprogram/components/user-avatar/*`, affected mini-program page data/WXML/WXSS files, `admin/src/utils/avatar.ts`, `admin/src/components/UserAvatar.vue`, affected admin views and shared styles
- Data impact: none
- API impact: none
- Verification: mini-program Jest utility/component coverage, admin Vitest utility/component coverage, targeted page checks and representative mini-program/admin visual regression
