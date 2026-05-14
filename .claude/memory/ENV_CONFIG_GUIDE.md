# 环境配置快速索引

本文件只保留高频入口，避免在会话里重复加载完整环境配置说明。

## 权威文档

- 统一环境配置指南：`docs/guides/ENV_CONFIG_GUIDE.md`
- 生产运维手册：`docs/guides/PRODUCTION_OPERATIONS_RUNBOOK.md`
- 部署说明：`docs/guides/DEPLOY_INSTRUCTIONS.md`

## 先看什么

按场景选择：

- 切换 `dev` / `prod`：看 `docs/guides/ENV_CONFIG_GUIDE.md`
- 排查线上配置差异：看 `docs/guides/PRODUCTION_OPERATIONS_RUNBOOK.md`
- 部署前核对环境变量：看 `docs/guides/DEPLOY_INSTRUCTIONS.md`

## 最小记忆集

只记住这几个点：

1. 根目录 `.env.config.js` 控制后端和管理后台主环境
2. `miniprogram/config/env.js` 是小程序独立配置，需要和主环境手动同步
3. 修改配置后必须重启对应服务
4. 敏感配置以 `backend/.env.production` 为准，不在 memory 文档里重复展开

## 高频操作

### 切到开发环境

- `.env.config.js` 中设置 `currentEnv = 'dev'`
- `miniprogram/config/env.js` 中设置相同值
- 重启后端和微信开发者工具

### 切到生产环境验证

- `miniprogram/config/env.js` 指向 `prod`
- 如需后端联调，再检查 `.env.config.js`
- 验证请求是否落到 `https://wx.shubai01.com/api/v1`

## 为什么缩短

历史上这里维护过一份完整长文档，但它与 `docs/guides/ENV_CONFIG_GUIDE.md` 重复。保留两份会增加会话上下文和维护成本。

最后更新：2026-05-14
