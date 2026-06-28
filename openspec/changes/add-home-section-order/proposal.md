# Change: Add Home Section Order Configuration

## Why
首页板块顺序目前写死在小程序中，运营无法按活动节奏调整“近期活动、今日任务、凡人生活、我的打卡、小凡看见、请求看见”的展示优先级。

## What Changes
- 新增租户级首页配置，保存首页板块展示顺序。
- 小程序首页按配置顺序渲染已有板块，并保留各板块原有显示条件。
- 管理后台提供首页配置页面，管理员可调整板块上下顺序并恢复默认。
- 调整横向卡片宽度，使“凡人生活”和“我的打卡”默认露出约 2.5 张卡片。

## Impact
- Affected specs: homepage-config
- Affected code: backend home config API, admin route/view/menu/API, miniprogram index page/service/styles
