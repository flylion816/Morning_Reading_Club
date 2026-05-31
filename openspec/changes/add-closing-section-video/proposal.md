# 变更：结营词支持结营视频

## Why
结营词目前只展示文本和打卡内容，无法承载结营仪式感更强的视频内容。运营需要在管理后台为最后一课结营词上传结营视频，小程序用户进入结营词课程后可直接观看，并在分享结营词时使用视频首帧作为分享封面。

## What Changes
- 课节数据增加结营视频信息，包含视频地址、原始文件名、文件大小、时长、首帧封面图和上传时间。
- 管理后台课程内容管理在课节编辑弹窗中增加“结营视频”上传区，用于最后一课结营词上传、预览、更换和删除视频。
- 后端增加受管理员鉴权和租户隔离保护的视频上传能力，并在创建、更新、详情、列表接口中返回结营视频字段。
- 小程序课程详情页在课节存在结营视频时展示“结营视频”板块，支持播放和分享给微信好友。
- 小程序分享结营词时，如果课节存在结营视频首帧封面，则分享卡片使用该封面图。

## Impact
- 影响规格：`course-content`
- 影响代码：`backend/src/models/Section.js`、`backend/src/controllers/section.controller.js`、`backend/src/routes/section.routes.js`、`admin/src/views/ContentManagementView.vue`、`admin/src/types/api.ts`、`miniprogram/pages/course-detail/*`、相关测试
