# Change: 摘抄本

## Why

书友读到想留下的句子时，没有地方可以收。摘下来的句子也是后面做日签、回看、看见「大家都在摘哪一句」的素材。

## What Changes

- 新增 `Highlight` 模型与 `/api/v1/highlights` 接口：摘下、改感想、删除、我的摘抄、某课热摘段落。
- 摘抄存原文与规范化哈希，不存段落序号；同一用户同一课同一段幂等。
- 前后端共用同一套文本规范化加 FNV-1a 32 位哈希（`backend/src/utils/text-hash.js`、`miniprogram/utils/text-hash.js`）。
- 新增小程序服务 `highlight.service.js` 与页面 `pages/highlights/highlights`（我的摘抄本，可按期次筛选、编辑感想、删除、做成日签）。
- 沉浸阅读页长按摘句的入口不在本次范围，由后续变更接入。

## Impact

- Affected specs: `reading-highlights`（新增）
- Affected code:
  - `backend/src/models/Highlight.js`、`backend/src/controllers/highlight.controller.js`、`backend/src/routes/highlight.routes.js`、`backend/src/utils/text-hash.js`
  - `miniprogram/services/highlight.service.js`、`miniprogram/utils/text-hash.js`、`miniprogram/pages/highlights/`
  - 待总控接线：`backend/src/app.js` 挂载 `/api/v1/highlights`，`miniprogram/app.json` 注册页面
