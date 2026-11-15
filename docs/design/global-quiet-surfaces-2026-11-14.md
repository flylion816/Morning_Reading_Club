# 小程序与管理后台视觉减重实施记录

日期：2026-11-14。用户已确认全局方向并授权实施。本轮为界面样式调整。

## 统一规则

- 公共主按钮默认 76rpx，首页阅读主操作为 68rpx；使用纯主色与轻阴影。
- 信息摘要、成员人数、用户身份、订单金额采用纸张或浅色表面，颜色通过文字和细边点缀。
- 分享、搜索、换头像等次操作使用浅色底及深色文字。
- 固定操作区使用暖白托盘、细分隔与安全区留白；课程详情主按钮最大 560rpx。
- 弱化全局卡片阴影，保持暖纸和暖墨中性色；图片、日签、信封和阅读场景维持各自表达。

## 全部 48 个注册页面

| 页面路径 | 本轮处理或检查结论 |
| --- | --- |
| `pages/index/index` | 今日主操作缩小、纯主色；慢递入口浅蓝底；角落卡取消重阴影 |
| `pages/periods/periods` | 顶部品牌横幅改纸张底，压缩高度；报名按钮纯主色 |
| `pages/meeting-webview/meeting-webview` | 核对已有浅色说明与跳转布局 |
| `pages/courses/courses` | 纸色课程导航；浅色选中页签；任务卡去重阴影 |
| `pages/checkin/checkin` | 纸色编辑区、浅色底栏；发布主操作纯主色 |
| `pages/insight-requests/insight-requests` | 核对已有浅色筛选、审批状态与申请卡 |
| `pages/share/share` | 缩短分享按钮，统一圆角与轻阴影 |
| `pages/period-detail/period-detail` | 整块期次色转为顶部细色线；标题纸张底；主操作纯色 |
| `pages/login/login` | 登录与跳过按钮压缩、去渐变；晨光场景继续承担品牌展示 |
| `pages/privacy-policy/privacy-policy` | 协议标题改纸色，底部按钮改浅底 |
| `pages/user-agreement/user-agreement` | 协议标题改纸色，底部按钮改浅底 |
| `pages/profile/profile` | 访客主按钮去渐变；公共卡片阴影降低 |
| `pages/edit-profile/edit-profile` | 换头像降为浅底次操作；保存操作与底栏统一 |
| `pages/podcast-player/podcast-player` | 深色播放内容场景；进度、装饰色统一晨光色并去发光阴影 |
| `pages/zaichang/list/list` | 在场内容卡使用公共轻阴影；深绿子品牌导航 |
| `pages/zaichang/detail/detail` | 在场内容详情删除操作使用浅红状态底 |
| `pages/zaichang/publish/publish` | 在场分类选中改浅底；发布按钮高度与字体收敛 |
| `pages/admin-analytics/admin-analytics` | 指标卡纸张底；筛选选中态改浅底 |
| `pages/admin-workbench/admin-workbench` | 页签改浅底；搜索操作去渐变 |
| `pages/admin-workbench/activity-registrations/activity-registrations` | 名单与统计页签改浅底；搜索操作使用轻阴影 |
| `pages/admin-section-insights/admin-section-insights` | 核对已有纸色标题、列表和数据展示 |
| `pages/community-activity-detail/community-activity-detail` | 浅色底部托盘；入会按钮改次操作；报名按钮保持主操作层级 |
| `pages/my-community-activities/my-community-activities` | 核对已有纸色列表、浅色状态标签 |
| `pages/activities/activities` | 活动封面占位改浅蓝纯色；现有状态标签保留语义 |
| `pages/my-coupons/my-coupons` | 券金额区域由深色渐变改浅蓝，金额与说明同步改深字 |
| `pages/insight-detail/insight-detail` | 弹幕、分享为浅底次操作；发送与海报确认统一纯主色 |
| `pages/course-detail/course-detail` | 课程标题纸色；去打卡缩至约75%屏宽；统一浅底托盘与足够滚动留白 |
| `pages/reading-mode/reading-mode` | 工具栏去重阴影；主动作去渐变；夜间工具栏按夜间纸色显示 |
| `pages/insights/insights` | 列表头部改纸色、深字；搜索按钮改浅蓝 |
| `pages/insight-edit/insight-edit` | 编辑头部改纸色；保存操作统一纯主色 |
| `pages/enrollment/enrollment` | 摘要改纸色；获取手机号降为次操作；提交区域改浅色固定托盘 |
| `pages/payment/payment` | 订单摘要纸色、深色金额；支付主操作纯色、降低阴影 |
| `pages/invite/invite` | 报名动作缩小；已报名改浅绿状态底与深绿字 |
| `pages/notifications/notifications` | 核对已有纸色消息列表与小尺寸状态标识 |
| `pages/notification-settings/notification-settings` | 头部纸色；补量主操作去渐变；浅色数量状态 |
| `pages/completion-reports/completion-reports` | 核对已有纸色报告列表与浅色状态标签 |
| `pages/completion-report-detail/completion-report-detail` | 报告主操作去渐变、统一按钮高度 |
| `pages/checkin-records/checkin-records` | 个人摘要纸张底；期次筛选浅底；搜索降为次操作 |
| `pages/profile-others/profile-others` | 用户大色块改纸色；昵称与签名同步调整为深字 |
| `pages/ranking/ranking` | 排名摘要纸色；分享降为浅底次操作 |
| `pages/members/members` | 大面积蓝色人数统计改为紧凑浅色统计条 |
| `pages/slow-mail/slow-mail` | 纸张、信封、邮筒场景；操作继承公共按钮与轻阴影 |
| `pages/keepsake/keepsake` | 纪念册信纸和信封场景；卡片继承公共轻阴影 |
| `pages/highlights/highlights` | 核对已有摘抄纸张卡、文字操作和浅色筛选 |
| `pages/seen-received/seen-received` | 核对已有纸张卡、文字数字层级 |
| `pages/practice/practice` | “做到了”改浅蓝选中态；确认操作继承公共按钮 |
| `pages/buddy/buddy` | 配对卡纸色，同行关系线；轻拍等操作继承公共按钮 |
| `pages/daily-card/daily-card` | 日签作品保留主题色；保存分享区域统一浅色托盘 |

## 公共组件和管理后台

- 活动弹窗降低浮层与主按钮阴影，头部色线减薄。
- 课程卡、悬浮播客条减少渐变及重阴影。
- 后台导航改浅色纸张表面，分组文字、图标、选中态、退出操作同步调整，确保深浅文字匹配。
- 后台仪表板指标卡改纯浅色底，关键数字和状态图标负责强调；所有 Element Plus 卡片降低重量。
- 租户切换时生成的阴影参数同步降低，避免切租户后恢复旧的重阴影。

## 验证

- 小程序全部 99 个测试套件，1247 项通过。
- 管理后台全部 37 个测试文件，328 项通过；Vite 生产构建通过。
- 全部 48 个 WXML 模板与 WXSS 文件解析通过；新操作 token 引用无缺失。
- 最后样式调整后，品牌色、公共设计层和晨光基础相关 20 项检查通过。
- 微信开发者工具通过界面重新编译成功，观察到首页浅色写信入口、缩小后的打卡按钮；打开课程详情后模板内容与操作栏正常出现。
- 本地基于真实 WXML/WXSS 与演示数据检查静态布局；后台使用本地演示接口进行桌面与 390px 手机布局浏览器预览。
- 静态布局预览与后台演示数据验证不等同于所有页面真机验证；未执行真实报名、支付、轻拍等写入流程。

## 交付状态

修改保留在当前工作区，尚未提交、推送或发布。已有其他任务的未提交修改继续保留。
