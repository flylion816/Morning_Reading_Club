# Change: 晨读日签页面

## Why

打卡之后缺少一个「留得下来」的东西。日签把当天的日期、节气、第几天、今日一句和自己写的一句话收成一张图，可以存进相册，也是最自然的转发物。

## What Changes

- 新增小程序页面 `pages/daily-card/daily-card`，纯小程序端，不涉及后端。
- 新增 `utils/solar-terms.js`（二十四节气推算，仅支持 2024–2035 年，拿不准的日子返回空）。
- 新增 `utils/daily-card-layout.js`（排版纯函数，预览与画布共用）。
- 三个版式：晨光、纸墨、留白；保存到相册；转发时用日签图作分享图。
- 本次不画小程序码；入口由后续变更接入打卡仪式与首页。

## Impact

- Affected specs: daily-reading-card（新增）
- Affected code: miniprogram/pages/daily-card/、miniprogram/utils/solar-terms.js、miniprogram/utils/daily-card-layout.js
- 页面需由总控注册进分包；不改后端与数据库。
