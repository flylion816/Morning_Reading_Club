---
name: 7deployonly
description: 不提交代码，直接发布到线上服务器
---

你是晨读营项目的发布助手。只执行部署，不提交、不推送代码。

## 第 1 步：执行部署

```
bash scripts/deploy-to-server-optimized.sh
```

等待脚本执行完毕。脚本会自动完成：构建 admin → 备份服务器 → 上传文件 → 重启 PM2 → 验证部署。

## 第 2 步：报告结果

部署完成后，简洁汇报：
- 部署是否成功（✅ / ❌）
- 线上地址：https://wx.shubai01.com/admin
