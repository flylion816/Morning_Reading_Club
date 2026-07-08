# Change: Add enrollment form statistics tab

## Why
运营需要按期次查看报名表填写内容，并快速了解报名人群画像、文本诉求和每个人的完整报名信息。当前后台报名管理只提供列表和单条详情，缺少按字段汇总和文本分析入口。

## What Changes
- 在管理后台报名管理页新增“报名信息统计”Tab。
- 支持选择期次后查看报名表字段明细、性别/年龄/地区/阅读经历/承诺/支付状态等维度统计。
- 增加缘起和期待的关键词/文本摘要列表，辅助运营快速判断用户需求。
- 增加管理员接口返回当前租户、指定期次范围内的报名统计数据。

## Impact
- Affected specs: enrollment-admin
- Affected code: backend enrollment controller/routes, admin enrollment API, admin enrollments view, targeted tests
