# Change: 小程序全端视觉一致性补齐

## Why

版本一已统一首页、期次、我的、课程阅读、报名和支付，但学习打卡、小凡看见、在场活动、通知报告和移动管理页面仍存在独立视觉语言。需要在既有设计系统上补齐剩余页面，避免用户在同一小程序中感受到多套界面。

## What Changes

- 将剩余主包与分包页面接入统一暖纸背景、租户主题、圆角、阴影和排版节奏。
- 统一列表卡、筛选 chip、表单、空态、加载态、固定底部操作、FAB 和按压反馈。
- 小凡看见“我的/他人的”列表改为分页加载，先渲染首页数据，再通过触底或按钮加载更多。
- 保留现有业务逻辑、接口调用和页面结构。

## Impact

- Affected code: `miniprogram/app.wxss`、`miniprogram/app.json` 中除版本一已覆盖页面外的剩余页面 WXSS/WXML、`miniprogram/pages/insights`
- Affected specs: `miniprogram-consistency-design`
- 无后端接口、数据模型和路由变化。
