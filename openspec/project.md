# Project Context

## Purpose
凡人共读是一个微信小程序晨读营系统，围绕期次、课节、报名、支付、每日打卡、社群互动、小凡看见反馈、订阅通知和管理后台运营构建。目标是支持用户在固定学习周期内完成晨读任务、记录实践、获得反馈并参与共读社区。

## Tech Stack
- 微信小程序原生框架 + WeUI
- Node.js + Express
- MongoDB + Mongoose
- Vue 3 管理后台
- Redis（缓存/限流/实时状态，按部署配置）
- MySQL 热备份/同步服务
- Jest / Vitest / Playwright（按模块使用）

## Project Conventions

### Code Style
- 代码优先遵循现有模块风格。
- 小程序用户 ID 统一使用 MongoDB `_id`。
- 小程序服务层通过 `miniprogram/utils/request.js` 统一请求。
- 后端新增接口应在 `routes/` 定义鉴权边界，在 `controllers/` 放业务逻辑。

### Architecture Patterns
- MongoDB 是主业务数据源。
- 管理后台管理员使用 `Admin` 模型和 `adminAuthMiddleware`，小程序用户使用 `User` 模型和 `authMiddleware`。
- 长图分享在小程序端 canvas 生成；长内容优先完整生成，失败后降级。
- 小凡看见内容支持 Markdown 渲染后的 HTML，海报生成需保留段落、列表、引用和加粗文本。

### Testing Strategy
- 小程序页面逻辑使用 Jest。
- 管理后台使用 Vitest。
- API 和关键业务流程可用 curl/Postman 验证。
- 修改长图、Markdown、权限、接口或数据模型时必须补回归测试。

### Git Workflow
- 提交信息使用 `feat:`、`fix:`、`docs:` 等前缀。
- 推送按项目 Git 工作流执行，避免直接覆盖用户未提交变更。

## Domain Context
- Period 表示学习期次。
- Section 表示期次下第 N 天课节。
- Checkin 表示用户对课节的打卡。
- Comment 表示打卡评论和回复。
- Insight 表示“小凡看见”反馈。
- InsightRequest 表示用户申请查看他人小凡看见。
- Notification 和 SubscribeMessage* 支撑站内通知和微信订阅消息。

## Important Constraints
- 严禁未经用户明确确认执行任何数据库重置或初始化脚本。
- 文档应以当前代码为准；历史 v3/v4/v6 文档只作背景。
- 管理端写操作必须明确管理员鉴权和角色边界。
- 长图生成必须考虑微信 canvas 尺寸、DPR、内存和导出失败。

## External Dependencies
- 微信登录与订阅消息
- 微信支付
- 腾讯会议跳转页
- MongoDB / Redis / MySQL
- Nginx / PM2 / Docker 部署配置
