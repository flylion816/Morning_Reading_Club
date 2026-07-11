# 管理员指南截图清单

所有截图均需按 `fanren`、`starry` 各拍一套，成品尺寸为 `1512x771` PNG。路由以管理后台根地址为前缀。

| 文件名 | 路由 | 截图前操作与画面重点 | 必须遮挡 |
| --- | --- | --- | --- |
| `annotated-01-dashboard.png` | `/` | 等待仪表板卡片加载，展示分组导航和核心入口 | 识别个人的数据、异常明细 |
| `annotated-02-analytics.png` | `/analytics` | 切换到“活跃度”，展示筛选器、指标和图表 | 用户名、排行身份信息 |
| `annotated-03-registrations.png` | `/enrollments` | 展示报名记录列表、搜索和常用操作 | 姓名、手机、报名答案、订单信息 |
| `annotated-03b-registration-statistics.png` | `/enrollments` | 进入“报名信息统计”，选择有代表性的期次 | 姓名、手机、自由填写内容、明细 |
| `annotated-04-users.png` | `/users` | 展示用户筛选、列表和管理入口 | 姓名、头像、手机、账号标识 |
| `annotated-05-payments.png` | `/payments` | 展示支付筛选、状态和列表结构 | 姓名、手机、订单号、金额明细、流水号 |
| `annotated-06-sections.png` | `/periods` | 打开一个期次的复制操作或复制对话框 | 非公开运营备注、识别个人的数据 |
| `annotated-07-contents.png` | `/content` | 展示内容列表、筛选和编辑入口 | 非公开内容、作者或账号信息 |
| `annotated-08a-checkins-records.png` | `/checkins` | 保持在打卡记录页签，展示搜索和记录列表 | 姓名、头像、打卡文本、账号标识 |
| `annotated-08b-checkins-celebration.png` | `/checkins` | 切到庆祝动画/阅读完成配置页签 | 上传文件中的私人信息、内部备注 |
| `annotated-09a-insights-list.png` | `/insights` | 展示小凡看见列表和查看入口；无数据可保留真实空态 | 用户身份、叙事正文、内部状态备注 |
| `annotated-09b-insights-view-unmasked.png` | `/insights` | 从列表进入详情，展示详情结构和操作；无数据可保留真实空态 | 即使文件名含 unmasked，也必须遮挡身份与叙事内容 |
| `annotated-10-applications.png` | `/insight-requests` | 展示查看申请列表、状态和处理入口 | 申请人、联系方式、申请文本、处理备注 |
| `annotated-11-completion-reports.png` | `/completion-reports` | 展示实录报告列表、筛选和操作 | 成员、手机、文件名、报告内容、下载地址 |
| `annotated-12-imprints.png` | `/imprints` | 展示在场管理列表、状态和管理操作 | 用户身份、正文、媒体和内部备注 |
| `annotated-13-activities.png` | `/activities` | 展示活动列表与创建/管理入口；无数据可保留真实空态 | 报名人、联系方式、非公开活动信息 |
| `annotated-14-coupons.png` | `/coupons` | 展示优惠券列表、状态和常用操作 | 领取用户、券码、内部使用明细 |
| `annotated-15-home-config.png` | `/home-config` | 展示首页板块排序、显示开关和保存方式 | 非公开配置值、账号信息 |
| `annotated-16-audit.png` | `/audit-logs` | 展示筛选、事件类型和审计列表结构 | 管理员账号、IP、对象标识、操作详情 |

## Annotation rules

- Use the same numbering and callout positions for both tenants when their layout is the same.
- Point to current labels and controls, not approximate regions from an older UI.
- Keep callouts inside the 1512x771 canvas and away from masked data.
- Use tenant branding only for page state; annotations should remain high-contrast and readable for both themes.
- If a required interaction no longer exists, update the guide, this map, and the deterministic screenshot list together.
