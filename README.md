# 协同之舞 Remotion 全片

基于已核验的 HyperFrames 完整成片时间轴，使用 Remotion 重做全片画面，保留现有 38 段脚本、9 位对应照片、194 条字幕、原旁白与配乐混音及 12 个章节。

## 输出

- `renders/协同之舞-结营观察-Remotion全片-1080P.mp4`：1920×1080、30fps、H.264/AAC、约 8 分 06 秒
- `中文字幕.srt`：194 条同步字幕
- `成片关键画面联系表.jpg`：6 个实际成片时间点的视觉抽查
- `核验报告.json`：时长、编码、章节、画面数与全片解码记录

## 复现

本机当前项目复用 `/Users/lion/Downloads/协同之舞-Remotion对照样片_20261011/node_modules` 的软链接。移到其他目录时执行 `npm ci` 后：

```bash
npm run render
```

原有 HyperFrames 成片保持独立。此 Remotion 全片先供效果评估；若用于企业正式发布，需按 Remotion 当前许可确认公司授权要求：https://github.com/remotion-dev/remotion/blob/main/LICENSE.md
