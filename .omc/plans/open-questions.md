# Open Questions

## zaichang-feature - 2026-05-22

- [ ] tabBar selectedColor 全局变更：从 `#4a90e2` 改为 `#2D5A3D`，会影响首页/晨读营/我的三个 Tab 的选中颜色。是否接受全局变更，还是保持原色仅「在场」Tab 特殊处理？ — 影响视觉一致性决策，执行 Task 7 前需确认。
- [ ] 用户搜索接口：`/api/v1/users` 是否支持 `search` 参数做昵称模糊搜索？若不支持需新增查询参数，执行 Task 6 前需确认。 — 影响发布页在场人搜索功能实现方式。
- [ ] 发布成功后列表页刷新机制：小程序 navigateBack 后列表页如何感知新数据？建议用 `onShow` 钩子检查标记位（`wx.getStorageSync('zaichang_need_refresh')`）。 — 影响 Task 4 和 Task 6 的协作方式，执行前需统一约定。
