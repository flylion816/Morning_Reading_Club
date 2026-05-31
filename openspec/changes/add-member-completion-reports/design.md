## Context
报告归属是“某期次里的某个成员”，现有 `Enrollment` 已经唯一约束 `tenantId + userId + periodId`，且后台报名列表可按期次筛选并 populate 用户昵称。通用上传接口已支持 PDF，文件路径按租户隔离，因此不需要引入新的文件存储服务。

## Goals
- 运营能在后台按期次看到成员列表，并给每个成员上传对应 PDF。
- 用户只能看到自己参加期次对应的实录报告。
- 小程序可以直接预览 PDF，并能通过微信文件能力转发给好友。
- 结营词和入口文案统一为“成员昵称 + 分享实录”。

## Non-Goals
- 不做 PDF 在线编辑、合并、自动生成。
- 不做公开报告广场，报告默认只对本人和管理员可见。
- 不改现有报名、支付和打卡流程。

## Data Model
优先扩展 `Enrollment`，新增嵌套字段：

```js
completionReport: {
  fileUrl: String,
  fileName: String,
  originalName: String,
  fileSize: Number,
  mimeType: String,
  uploadedAt: Date,
  uploadedBy: ObjectId,
  title: String
}
```

默认标题由后端返回时计算：`{nickname || enrollment.name || '成员'}分享实录`。如需要运营手动改名，可后续开放 `title` 编辑；首版可自动生成，减少后台输入。

字段约束：
- `fileUrl` 必须是现有上传接口返回的租户隔离路径，例如 `/uploads/tenants/<slug>/<filename>.pdf`。
- `mimeType` 只接受 `application/pdf`；同时用 `fileName/originalName/fileUrl` 的 `.pdf` 扩展名做兜底校验。
- `fileSize` 记录字节数，用于前后端展示。
- 清空报告时将整个 `completionReport` 置空，不删除报名记录。

## Backend API
新增管理员接口：

- `GET /api/v1/enrollments/reports?periodId=&search=&page=&limit=`
  - 返回报名成员、期次、用户昵称、报告元数据和 `hasReport`。
  - `periodId` 可选；传入时只返回该期次成员，未传时按报名时间倒序返回所有成员。
  - `search` 匹配报名姓名、手机号、用户昵称。
- `PUT /api/v1/enrollments/:id/completion-report`
  - body 使用已上传文件元数据 `{ fileUrl, fileName, originalName, fileSize, mimeType }`。
  - 校验文件必须为 PDF，报名记录必须属于当前租户。
- `DELETE /api/v1/enrollments/:id/completion-report`
  - 只清空绑定元数据；是否物理删除上传文件沿用现有上传删除能力，避免误删被引用文件。

管理员列表返回示例：

```json
{
  "list": [
    {
      "_id": "enrollmentId",
      "period": { "_id": "periodId", "name": "第 12 期" },
      "user": { "_id": "userId", "nickname": "狮子", "avatarUrl": "" },
      "name": "张三",
      "phone": "135****3520",
      "paymentStatus": "paid",
      "reportTitle": "狮子分享实录",
      "hasReport": true,
      "completionReport": {
        "fileUrl": "/uploads/tenants/default/xxx.pdf",
        "fileName": "xxx.pdf",
        "originalName": "凡人晨读·秩序之锚 - 狮子分享实录 -20260530.pdf",
        "fileSize": 3774873,
        "mimeType": "application/pdf",
        "uploadedAt": "2026-05-30T10:00:00.000Z"
      }
    }
  ],
  "total": 1
}
```

新增小程序用户接口：

- `GET /api/v1/enrollments/my-completion-reports`
  - 返回当前用户 active/completed 且 paid/free 的期次报告列表。
- `GET /api/v1/enrollments/my-completion-reports/:periodId`
  - 返回当前用户某期次报告详情。

用户接口返回报告和未上传记录。未上传记录用于“我的实录报告”显示“报告整理中”，但详情页只有 `hasReport=true` 时允许查看 PDF。

用户列表返回示例：

```json
{
  "list": [
    {
      "periodId": "periodId",
      "periodName": "第 12 期晨读营",
      "reportTitle": "狮子分享实录",
      "hasReport": true,
      "fileName": "凡人晨读·秩序之锚 - 狮子分享实录 -20260530.pdf",
      "fileSize": 3774873,
      "uploadedAt": "2026-05-30T10:00:00.000Z"
    }
  ]
}
```

首页今日任务可以复用列表接口按当前期次匹配，或在今日任务接口附带 `completionReport` 摘要。首版建议小程序加载今日任务后调用轻量报告列表并本地匹配，避免改动课程接口。

## Admin UX
新增侧边栏入口：内容管理下“📄 实录报告”。

页面布局：
- 顶部：期次筛选、成员姓名/昵称搜索、只看未上传开关。
- 表格：成员头像/昵称、报名姓名、手机号、期次、支付状态、报告状态、文件名、大小、上传时间、操作。
- 操作：上传/替换 PDF、预览链接、复制链接、清空报告。
- 上传限制：仅 `.pdf`，建议单文件上限沿用后端 200MB，但前端提示建议 50MB 内。

上传交互：
- 点击“上传 PDF”后调用现有 `/api/v1/upload`，成功后再调用绑定接口写入报名记录。
- 替换已有报告前弹确认：“替换后小程序将展示新的 PDF，确定替换吗？”。
- 清空报告前弹确认：“清空后用户将看不到该实录报告，确定清空吗？”。
- 上传失败时保留当前表格状态，不清空原报告。

结营词排布：
- 在结营词详情页或成员列表区按成员卡片展示：头像、成员昵称、`成员昵称分享实录`、PDF 文件名/大小。
- 有报告时展示“查看实录”操作；无报告时后台显示“未上传”，小程序端面向用户显示“报告整理中”或隐藏入口，避免出现死链。

## Miniprogram UX
新增“我的”tab 设置项：`我的实录报告`，放在“我的打卡日记”之后。

报告列表页：
- 按期次倒序展示卡片。
- 卡片主标题：期次名。
- 副标题：`成员昵称分享实录`。
- 状态：已上传显示文件大小和上传时间；未上传显示“报告整理中”。
- 空态：没有参加过期次时显示“暂无实录报告”；参加过但均未上传时显示卡片和“报告整理中”。

报告详情页：
- 顶部信息：`成员昵称分享实录`、期次、文件大小、上传时间。
- 主操作按钮：`查看 PDF`。
- 次操作按钮：`分享到微信`。
- 辅助操作：`复制链接` 作为 `wx.shareFileMessage` 不可用或下载失败时的降级。
- 未上传状态：展示“报告整理中”，不显示查看和分享按钮。
- 加载失败：展示重试按钮；404/403 展示“报告不存在或暂无权限”。

首页“今日任务”按钮：
- 当 `todaySection` 所属期次存在当前用户报告时，在“去晨读/去打卡/去播客”同一按钮区显示 `看实录`。
- 点击直达报告详情页：`/pages/completion-report-detail/completion-report-detail?periodId=...`。

## PDF Open / Share
小程序侧推荐流程：

1. `wx.downloadFile({ url })` 获取远程 PDF 的临时文件路径；这是微信打开和分享文件所需的技术步骤，不作为用户侧“下载到手机”的承诺。
2. `wx.openDocument({ filePath, fileType: 'pdf', showMenu: true })` 打开预览；`showMenu` 允许微信文档页里转发/收藏等菜单。
3. 如果基础库支持 `wx.shareFileMessage`，提供“分享到微信”按钮直接分享临时 PDF 文件。
4. 如果不支持，提示用户在 PDF 预览页右上角菜单转发，并提供复制链接降级。

因此产品能力定义为“查看 PDF”和“分享到微信”，不单独设计“下载到手机”按钮。

实现注意：
- `fileUrl` 是相对路径时，小程序服务层需要拼接 API 域名。
- 预览前先检查 `hasReport` 和 `fileUrl`，避免下载空地址。
- 分享按钮首次点击时若还没有临时文件，先下载再分享，并缓存本次页面生命周期内的临时路径。
- `wx.shareFileMessage` 不存在或失败时，不阻断查看 PDF；提示“可在 PDF 预览页右上角菜单分享”。

## Permissions
- 管理员上传、替换、删除必须使用 `adminAuthMiddleware + adminTenantContext`。
- 用户接口必须使用 `authMiddleware + userTenantContext`。
- 用户只能读取 `userId = req.user.userId` 的报告。
- 报告列表仅返回用户已报名且 `paymentStatus in ['paid', 'free']` 的记录。
- 后台接口必须受租户隔离约束，platform superadmin 仍需选择 active tenant 后才能上传和绑定。
- 小程序接口不接受任意 `enrollmentId` 查询，详情使用 `periodId` 并结合当前用户查自己的报名记录。

## Migration
- 现有报名记录默认没有 `completionReport`，不需要数据迁移。
- 后台列表将这些记录视为 `hasReport=false`。
- 不执行任何数据库初始化、清空或重置脚本。

## Testing
- 后端：覆盖管理员绑定 PDF、拒绝非 PDF、用户只能读自己报告、未支付报名不返回、无报告详情返回明确状态。
- 管理后台：覆盖 API 参数、上传成功后绑定、替换确认、清空确认、筛选未上传。
- 小程序：覆盖“我的”入口、报告列表状态、详情查看 PDF、分享到微信降级、首页“看实录”显示条件。

## Rollout
- 先上线数据字段和后台绑定能力。
- 再上线小程序列表/详情和“我的”入口。
- 最后在首页今日任务显示“看实录”按钮。
