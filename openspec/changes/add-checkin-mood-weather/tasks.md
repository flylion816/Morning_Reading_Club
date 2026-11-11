## 1. 后端
- [x] 1.1 Checkin.mood 枚举新增 low，可空
- [x] 1.2 集中常量 MOOD_VALID_SINCE 与读出规则
- [x] 1.3 创建/编辑打卡校验 mood
- [x] 1.4 mood-summary 接口与路由
- [x] 1.5 打卡日历返回 moods
- [x] 1.6 本人列表应用生效时间规则，他人列表不返回 mood
- [x] 1.7 单元测试

- [x] 1.8 moodSource 协议：仅 picker 标记才采纳 mood
- [x] 1.9 小凡看见详情 populate 打卡去掉 mood

## 2. 小程序服务层
- [x] 2.1 getSectionMoodSummary
- [x] 2.2 utils/mood.js 心情选项常量
- [x] 2.3 服务与常量测试
- [x] 2.4 打卡页天气选择器（已接入 pages/checkin，提交时带 moodSource: picker）
