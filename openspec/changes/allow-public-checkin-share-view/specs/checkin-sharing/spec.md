## ADDED Requirements

### Requirement: Public check-in details are share-viewable

系统 SHALL 允许任何访客查看公开打卡详情，不得因访客已登录但未参加当前期次而拒绝访问。

#### Scenario: Logged-in non-enrolled friend opens a public share

- **WHEN** 已登录但未参加该期次的好友打开公开打卡分享链接
- **THEN** 系统返回打卡详情
- **AND** 系统不执行期次社群付费权限拦截

#### Scenario: Anonymous visitor opens a public share

- **WHEN** 未登录访客打开公开打卡分享链接
- **THEN** 系统返回打卡详情

### Requirement: Private check-in access remains restricted

系统 SHALL 继续保护私密打卡详情的访问边界。

#### Scenario: Anonymous visitor opens a private check-in

- **WHEN** 未登录访客请求私密打卡详情
- **THEN** 系统拒绝访问并返回 403

#### Scenario: Authenticated visitor opens a private check-in

- **WHEN** 已登录用户请求私密打卡详情
- **THEN** 系统执行原有期次社群权限校验

### Requirement: Check-in detail rendering is independent from course content

小程序 SHALL 在打卡详情模式下使用打卡详情数据渲染公开打卡，不依赖受权限保护的课程详情接口。

#### Scenario: Anonymous visitor opens a public check-in detail

- **WHEN** 未登录访客打开公开打卡详情
- **THEN** 小程序渲染打卡作者、正文和图片
- **AND** 小程序不请求课程详情接口

### Requirement: Check-in comments require community access

系统 SHALL 仅向已登录且具备所属期次社群权限的用户展示打卡评论。

#### Scenario: Visitor without community access opens comments

- **WHEN** 未登录或未具备期次社群权限的用户打开公开打卡详情
- **THEN** 系统显示评论锁定提示
- **AND** 系统不请求或返回打卡评论内容
