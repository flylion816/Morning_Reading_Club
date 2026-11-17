## MODIFIED Requirements

### Requirement: 读伴只能看到有限信息
读伴之间 SHALL 只能看到对方的昵称、头像，对方今天是否读过、是否打卡的两个布尔值，以及对方当天送来的一句话（预设短句，或对方自己写的一句，规则见 buddy-companion 的「送一句」）；系统 MUST NOT 提供聊天、回复或其他自由文字。今天的自然日 MUST 按东八区计算。

#### Scenario: 读取状态
- **WHEN** 已配对的用户读取读伴状态
- **THEN** 返回对方的昵称、头像、readToday、checkedInToday，以及对方今天送来的一句话（如有），不包含打卡内容。

#### Scenario: 没有聊天
- **WHEN** 读伴想对 TA 说更多
- **THEN** 系统 MUST NOT 提供回复或聊天入口，每人每天只有「送一句」这一句。
