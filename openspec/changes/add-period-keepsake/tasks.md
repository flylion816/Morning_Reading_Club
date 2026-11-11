## 1. 后端
- [x] 1.1 keepsake.service.js 聚合（find + lean，期次结束后 10 分钟内存缓存）
- [x] 1.2 keepsake.controller.js 与 keepsake.routes.js（认证 + 租户 + 已报名校验）
- [x] 1.3 mocha 单元测试
- [x] 1.4 app.js 挂载 /api/v1/keepsakes（已由总控接线）

## 2. 小程序
- [x] 2.1 services/keepsake.service.js
- [x] 2.2 pages/keepsake 页面（swiper 纵向翻页、未结营提示、重试、分享）
- [x] 2.3 Jest 测试
- [x] 2.4 app.json 注册分包，「我的」足迹印章与课程页入口（已完成）
- [ ] 2.5 分享长图（本次未做，分享走 onShareAppMessage）

## 3. 一期一本册子（2026-11-11 追加）
- [x] 3.1 后端：开营后即可查看（返回 finished 标记），未开营返回 notStarted
- [x] 3.2 后端：新增 days（每一天的打卡目录）、insights（本期全部小凡的信）、buddy（读伴，不含对方用户 ID）、practices（每周实修）
- [x] 3.3 小程序：按「我写下的 / 每一天 / 同行的人 / 写给自己的 / 小凡的话 / 分享实录」分章，章名只出现在每章第一页
- [x] 3.4 小程序：末尾接入实录报告入口（有报告才显示），「每一天」「小凡的话」可点开看原文
- [x] 3.5 兼容旧版接口（只有 insightExcerpt、没有 finished 字段）
- [x] 3.6 mocha 与 Jest 测试
- [ ] 3.7 开发者工具与真机检查分章后的版式（需要人工）
