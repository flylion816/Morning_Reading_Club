## ADDED Requirements

### Requirement: Public insight details are share-viewable

系统 SHALL 允许任何访客通过分享路径浏览已公开的小凡看见详情，不得在小程序侧因未登录或未验证付费社群权限而重定向到首页。

#### Scenario: Anonymous visitor opens an insight share

- **WHEN** 未登录访客打开公开小凡看见分享链接
- **THEN** 小程序保留并渲染对应详情页
- **AND** 小程序不重定向到首页

### Requirement: Insight interactions require community access

系统 SHALL 仅向已登录且具备所属期次社群权限的用户展示小凡看见点赞与弹幕互动；未登录或无权限用户 SHALL 只能浏览公开内容。

#### Scenario: Visitor without community access opens an insight

- **WHEN** 未登录或未具备所属期次社群权限的用户打开公开小凡看见详情
- **THEN** 页面隐藏点赞与弹幕入口
- **AND** 页面不请求弹幕内容
