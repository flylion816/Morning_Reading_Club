# Change: 小程序「晨光」第一批——换一张暖的纸

## Why

11-06 的两轮改版已把页面收进统一设计令牌，但中性色偏青、全局没有暖色、每页顶部是一整条品牌色导航、图标是各机型长相不同的 emoji、文案偏功能化，整体像「整洁的学习工具」而不是「清晨一起读书的地方」。第一批只改令牌、导航规则、图标基础类和核心文案，不动业务逻辑，用最小代价改变整体气质，并为第二、三批打好底。

## What Changes

- 将 `app.wxss` 中性色令牌从青灰换成暖纸（页面底色、纸面、文字、细线、阴影），并清扫页面样式中写死的绿调与冷灰色值。
- 新增三租户共用的晨光辅色令牌（`--app-dawn`、`--app-dawn-soft`、`--app-dawn-ink`），只用于时间与仪式，不用于按钮。
- 新增衬线字体令牌与数字字体令牌，仅用系统自带字体，不新增字体文件。
- 导航栏规则调整：内容页默认纸色深字；品牌页（晨读营页头、「在场」列表页）保留租户色或深绿；「在场」详情与发布页改纸色；Tab 栏改纸色并去掉黑色分隔线；打卡页改为纸色页眉；`apply-tenant.js` 同步增加纸色导航页名单。
- 新增全局印章组件类 `.app-seal` 与约 16 个内联 SVG 线性图标，替换首页与课程详情的 emoji 图标（用户内容与后台配置除外）。
- 统一核心链路约 30 条文案口吻，去掉口号式与「暂无」式表达。
- 新增 `utils/feedback.js`，统一封装点赞、打卡成功、读完、长按摘句四个时刻的震动与成功提示。
- 「在场」中性色并入全局令牌，深绿通过作用域主题覆盖实现，赭石并入晨光色系。
- 白字压主色的小字按钮统一改用深一档主题色，对比度达标。
- 设计回归测试断言按新规则改写（不是删除）。
- 不改租户主色、logo、Tab 图标图片；不引入框架或字体文件。

## Impact

- Affected specs: `miniprogram-dawn-foundation`（新增）
- Affected code:
  - `miniprogram/app.wxss`、`miniprogram/app.json`（全局导航与 Tab 栏）
  - `miniprogram/scripts/apply-tenant.js`
  - `miniprogram/utils/feedback.js`（新增）
  - `miniprogram/pages/index`、`miniprogram/pages/course-detail`、`miniprogram/pages/checkin`（核心链路样式、图标与文案）
  - `miniprogram/pages/**` 与分包页面中带写死冷色值的 WXSS
  - 「在场」相关页面（列表、详情、发布）样式与导航配置
  - `miniprogram/__tests__/design/*.spec.js`、`theme-colors.spec.js`、`brand-color-regression.spec.js`
- 无后端接口、数据模型和小程序路由变化。
