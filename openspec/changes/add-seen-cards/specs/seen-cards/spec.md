## ADDED Requirements

### Requirement: 预设短句
系统 SHALL 只接受四个预设短句键：persist（我看见你的坚持）、touched（这句话说到我心里了）、thanks（谢谢你愿意说出来）、metoo（我也是这样）。系统 MUST 拒绝任何其他取值，且 MUST NOT 接受自由输入。

#### Scenario: 非预设短句被拒绝
- **WHEN** 用户提交的 phrase 不是四个短句键之一
- **THEN** 系统 SHALL 返回 400，且不创建看见卡

### Requirement: 送出、更换与撤回
一个用户对同一篇打卡 SHALL 最多有一张看见卡。用户 MUST NOT 给自己的打卡送看见卡。

#### Scenario: 首次送出
- **WHEN** 用户对他人的可见打卡提交合法短句
- **THEN** 系统 SHALL 创建一张看见卡并返回 created 为 true

#### Scenario: 更换短句
- **WHEN** 用户对已送过卡的打卡提交另一个合法短句
- **THEN** 系统 SHALL 更新原卡片的短句，且不新增卡片

#### Scenario: 给自己的打卡送卡
- **WHEN** 用户对自己的打卡提交看见卡
- **THEN** 系统 SHALL 返回 400

#### Scenario: 撤回
- **WHEN** 用户撤回自己送的看见卡
- **THEN** 系统 SHALL 删除该卡片，且只能删除本人送出的卡片

### Requirement: 权限与可见性
送卡用户 MUST 对该打卡所属期次拥有社群权限，且只能对自己看得到的打卡送卡。

#### Scenario: 没有期次权限
- **WHEN** 用户未支付或未报名该期次
- **THEN** 系统 SHALL 返回 403，且不创建看见卡

#### Scenario: 私密打卡
- **WHEN** 打卡的 isPublic 为 false，且送卡用户既不是作者也不是管理员
- **THEN** 系统 SHALL 返回 403

### Requirement: 站内通知
系统 SHALL 在看见卡首次送出时向打卡作者发送类型为 seen_received 的站内通知，标题为「有书友看见了你」，内容为「{昵称}：{短句}」，并带有能跳回该打卡的 targetPage、sectionId、checkinId。系统 MUST NOT 在更换短句时重复通知，且 MUST NOT 发送订阅消息。

#### Scenario: 首次送出通知作者
- **WHEN** 看见卡首次创建成功
- **THEN** 作者 SHALL 收到一条 seen_received 通知

#### Scenario: 通知失败不影响送卡
- **WHEN** 通知发送抛出错误
- **THEN** 送卡请求 SHALL 仍然成功返回

### Requirement: 汇总与收到的列表
系统 SHALL 提供单篇汇总（total、四个短句的 counts、本人的 mine、最近 5 位送卡人 recent）、批量汇总（一次最多 50 篇，返回每篇的 total 和 mine）和本人收到的看见卡分页列表（按时间倒序，含送卡人昵称头像、短句、课程标题、期次名、时间）。

#### Scenario: 单篇汇总
- **WHEN** 用户请求某篇可见打卡的汇总
- **THEN** 系统 SHALL 返回 total、counts、mine 和最多 5 条 recent

#### Scenario: 批量汇总超限
- **WHEN** checkinIds 超过 50 个
- **THEN** 系统 SHALL 返回 400

#### Scenario: 收到的列表
- **WHEN** 用户请求 /received
- **THEN** 系统 SHALL 只返回 receiverId 为本人的看见卡，按创建时间倒序，并返回 list 与 total

### Requirement: 「被看见」页面
小程序 SHALL 提供「被看见」页面，顶部显示「这些时刻，有人看见了你」和总数，列表逐条显示送卡人、短句、来源打卡的课程标题与期次名及时间，点击跳转到对应打卡详情。页面 MUST 处理未登录、加载中、空态和接口失败重试。

#### Scenario: 空态
- **WHEN** 用户没有收到任何看见卡
- **THEN** 页面 SHALL 显示「还没有收到看见卡。多写一点，会有人看见的」

#### Scenario: 接口失败
- **WHEN** 列表接口失败
- **THEN** 页面 SHALL 在页内显示失败提示和重试按钮

#### Scenario: 点击跳转
- **WHEN** 用户点击一条看见卡
- **THEN** 页面 SHALL 跳转到该打卡所在课程详情页并带上 checkinId
