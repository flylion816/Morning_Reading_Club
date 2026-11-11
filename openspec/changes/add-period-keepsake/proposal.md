# Change: 「我的 23 天」结营纪念册

## Why
结营是整期情绪最高的时刻，现有视频与报告都是营方做给大家的。每位书友需要一份属于自己的 23 天，也是下一期最好的邀请素材。

## What Changes
- 新增只读汇总接口 `GET /keepsakes/period/:periodId`，现有数据在内存聚合，不新建数据表。
- 新增分包页面 `pages/keepsake/keepsake`，纵向一页一页翻看，没有数据的页自动跳过。
- 摘抄、慢递信、看见卡模型可能尚未上线，后端安全取用，缺失时返回空值。

## Impact
- Affected specs: period-keepsake（新增）
- Affected code: backend/src/{controllers,routes,services}/keepsake.*、miniprogram/pages/keepsake、miniprogram/services/keepsake.service.js
- 总控需在 app.js 挂载 `/api/v1/keepsakes`，在 app.json 注册分包页面。
