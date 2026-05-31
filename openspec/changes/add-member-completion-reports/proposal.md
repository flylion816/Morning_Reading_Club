# Change: Add member completion report PDFs

## Why
结营词和后续复盘需要按成员展示“成员昵称 + 分享实录”PDF。运营侧目前缺少按期次成员上传 PDF 的入口，小程序侧也缺少统一的实录报告列表、查看和分享到微信能力。

## What Changes
- 在报名记录上绑定结营实录 PDF 元数据，形成“期次 + 成员”的一对一报告归属。
- 管理后台新增“实录报告”管理入口，支持按期次筛选成员、逐个上传/替换/删除 PDF，并展示上传状态。
- 小程序新增“我的实录报告”页面，展示当前用户已参加期次的报告列表。
- 小程序首页“今日任务”卡片在当前用户有该期次报告时显示“看实录”按钮，可直达报告详情。
- 小程序报告详情页支持打开 PDF 预览、分享到微信，并展示文件名、大小、上传时间和所属期次。
- 结营词相关展示使用“成员昵称 + 分享实录”作为报告标题，缺少报告时隐藏入口或显示未上传状态。
- 不提供“下载到手机”产品按钮；微信侧通过文档预览和文件分享承接查看与转发。

## Impact
- Affected specs: completion-reports
- Affected code:
  - `backend/src/models/Enrollment.js`
  - `backend/src/controllers/enrollment.controller.js`
  - `backend/src/routes/enrollment.routes.js`
  - `backend/src/routes/upload.routes.js`
  - `admin/src/services/api.ts`
  - `admin/src/router/index.ts`
  - `admin/src/components/AdminLayout.vue`
  - new admin report management view
  - `miniprogram/app.json`
  - `miniprogram/pages/index/*`
  - `miniprogram/pages/profile/*`
  - new miniprogram report list/detail pages and service
