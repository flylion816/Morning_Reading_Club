# Change: 首页新建打卡入口

## Why

用户在首页看到自己的打卡卡片后，仍需要依赖“今日任务”才能进入打卡编辑页；补卡或选择其他期次、其他课节打卡的路径不直观。

## What Changes

- 在首页“我的打卡”卡片右上角增加圆形“＋”新建打卡入口。
- 打开打卡页时先展示期次与课节选择，默认选中首页当前期次和今日课程。
- 只列出用户已有效报名（免费或付费）的期次，并在切换期次后加载该期已发布课节。
- 小程序端将免费报名与付费成功统一视为可参与打卡/互动。

## Impact

- Affected code: `miniprogram/pages/index`、`miniprogram/pages/checkin`、`miniprogram/utils/period-access.js`
- Affected specs: `period-checkin`
- 无后端接口和数据模型变化，继续复用现有报名、课节和打卡接口。
