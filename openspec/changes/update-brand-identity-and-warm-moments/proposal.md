# Change: 品牌视觉更新与三个温暖时刻

## Why

「晨光」三批做完后，界面底色、字体、图标都已是暖纸，但凡人共读的主色仍是饱和的亮蓝（`#4a90e2`，白字对比度只有 3.3:1），Tab 图标是灰色实心块，logo 是占位图，放在暖纸上成了最冷的一块。同时入营、结营、隔了几天回来这三个时刻没有任何回应，出错和推送的措辞仍是系统口吻。品牌方已确认 logo 和 Tab 图标可以更换。

## What Changes

- 凡人共读主色由 `#4a90e2` 改为黛蓝 `#3d6fa6`（白字对比度 5.2:1），主题变量、Tab 选中色、晨读营页头随之重新生成；Tab 未选中色三个租户统一为暖灰 `#857a6c`。
- 新增 `miniprogram/scripts/generate-brand-assets.js`：用同一套 SVG 为三个租户生成 Tab 图标（线性图标，选中态为主色线条加一处晨光色），为凡人共读、超人读书会生成 logo，为凡人共读生成分享封面；大尺寸 logo 输出到 `docs/design/brand/`。若星生活家保留自己的字标。
- 期次卡片封面仍是旧默认蓝渐变时改为跟随当前主题色；后台单独设置过的封面色不变。
- 入营：支付成功或免费报名后进入课程页时出现一次欢迎卡，可直接去写开营信（仅在当前可写时显示该按钮）。
- 结营：首页结营卡片的主按钮改为「翻开纪念册」，结营实录降为文字入口。
- 回来：今日晨读未打卡且距上次打卡三天以上时，今日卡片显示一句「回来就好」，不出现具体天数。
- 口吻：书友可见的失败提示、「暂无」类空文案、他人主页统计、站内通知标题、晨读提醒的措辞统一为营里人说话的口吻。
- 不改后台与后端的新租户默认色，不写线上数据库。

## Impact

- Affected specs: miniprogram-brand-identity（新增）
- Affected code: `miniprogram/config/tenants/*.js`、`miniprogram/theme.wxss`、`miniprogram/app.json`、`miniprogram/assets/tenants/**`、`miniprogram/components/course-card`、`miniprogram/pages/{index,courses,payment,enrollment,profile-others,login}` 及各页面提示文案；`backend/src/controllers/{checkin,comment,insight}.controller.js`、`backend/src/services/study-reminder.service.js`
- 上线依赖：小程序需重新上传；通知标题和晨读提醒需发布后端；线上凡人共读租户的主色需在管理后台同步改为 `#3d6fa6`，否则下次 `tenant:sync` 会把配置改回旧色。
