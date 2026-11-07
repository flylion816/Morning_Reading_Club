# Change: 小程序核心链路视觉升级

## Why

小程序主链路已经承载期次浏览、课程学习、报名和支付，但各页面样式分散、主题变量覆盖不足、交互反馈和安全区处理不一致。需要先统一核心链路，为后续全端视觉一致性升级建立基础。

## What Changes

- 扩展小程序全局设计令牌和通用样式类。
- 升级首页、晨读营、我的、课程详情、沉浸阅读、报名和支付页面的视觉层级。
- 统一高频按钮、卡片、标签、表单、空态、骨架屏和按压反馈。
- 保留现有业务逻辑、接口调用和页面路由。

## Impact

- Affected code: `miniprogram/app.wxss`、`miniprogram/pages/index`、`miniprogram/pages/periods`、`miniprogram/pages/profile`、`miniprogram/pages/course-detail`、`miniprogram/pages/reading-mode`、`miniprogram/pages/enrollment`、`miniprogram/pages/payment`
- Affected specs: `miniprogram-core-journey-design`
- 无后端接口、数据模型和小程序路由变化。
