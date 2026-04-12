# 打卡详情与长图分享发布核对清单

最后更新: 2026-04-12

## 适用范围

本清单适用于以下小程序改动上线:

- 我的 > 我的打卡日记
- 打卡记录点击进入单条动态详情
- 动态详情页评论/点赞/分享
- 动态详情长图生成与保存

## 本次改动文件

- `miniprogram/pages/checkin-records/checkin-records.js`
- `miniprogram/pages/checkin-records/checkin-records.wxml`
- `miniprogram/pages/course-detail/course-detail.js`
- `miniprogram/pages/course-detail/course-detail.wxml`
- `miniprogram/pages/course-detail/course-detail.wxss`
- `miniprogram/__tests__/pages/checkin-records.spec.js`
- `miniprogram/__tests__/pages/course-detail.spec.js`
- `miniprogram/__tests__/setup.js`

## 发布前本地检查

- [ ] `npm run test:miniprogram -- --runInBand` 通过
- [ ] 微信开发者工具打开项目根目录，不是只打开 `miniprogram/`
- [ ] 微信开发者工具重新编译成功，无 WXML / WXSS / JS 运行时错误
- [ ] 账号已登录到正确的生产 AppID
- [ ] `miniprogram/config/env.js` 指向生产环境

## 必做真机回归

### 1. 我的打卡日记入口

- [ ] 我的页能看到“我的打卡日记”
- [ ] 点击后进入记录页
- [ ] 顶部显示日记数、获赞数
- [ ] 横向期次切换正常

### 2. 打卡记录进入详情

- [ ] 点击任意打卡记录，进入“动态详情”
- [ ] 页面不再显示课程正文模块和整组打卡列表
- [ ] 页面顶部显示作者、任务信息、正文
- [ ] 下方显示“全部评论”
- [ ] 无评论时显示空态

### 3. 评论与互动

- [ ] 点击“说点什么...”可以发布评论
- [ ] 评论后列表即时刷新
- [ ] 打卡点赞正常
- [ ] 评论点赞正常
- [ ] 评论回复正常
- [ ] 嵌套回复正常

### 4. 分享

- [ ] 右上角微信分享能正常拉起
- [ ] 分享卡片标题为“xxx的打卡日记”
- [ ] 分享出去后，打开能落到同一条打卡详情

### 5. 长图

- [ ] 点击“长图”后出现“生成中...”
- [ ] 生成完成后弹出操作面板
- [ ] 选择“预览长图”可以看到图片
- [ ] 长按预览图可保存
- [ ] 选择“保存到相册”可直接保存
- [ ] 首次拒绝相册权限后，页面有明确提示

## 上传步骤

### 微信开发者工具

1. 打开项目
2. 点击“编译”
3. 真机预览执行上面的真机回归
4. 点击“上传”

建议上传备注:

```text
修复我的打卡日记点击后仍进入课程详情布局的问题
新增单条动态详情页
补充动态详情长图生成与保存能力
优化打卡详情评论/分享链路
```

## 提审前确认

- [ ] 体验版真机回归完成
- [ ] iOS 与 Android 至少各验一次详情页和长图
- [ ] 分享链路至少验证 1 次
- [ ] 长图保存链路至少验证 1 次
- [ ] 没有新增白屏、卡死、按钮无响应

## 线上验收口径

### 成功标准

- 记录列表点击后 100% 进入单条动态详情
- 分享链接能还原到对应 `checkinId`
- 长图生成成功率稳定，无明显卡顿或崩溃

### 重点风险

- 低版本基础库对 `canvas type=2d` 的兼容性
- 用户未授权相册时的保存失败处理
- 特别长的打卡正文生成长图时间偏长

## 回滚策略

如果体验版发现问题，优先按下面顺序处理:

1. 停止提审，不发布体验版为正式版
2. 回退以下文件到上一个稳定版本:
   - `miniprogram/pages/course-detail/course-detail.js`
   - `miniprogram/pages/course-detail/course-detail.wxml`
   - `miniprogram/pages/course-detail/course-detail.wxss`
3. 保留“我的打卡日记”入口，但暂时回到旧详情页链路
4. 重新编译并走一次最小回归

## 备注

- 当前仓库没有自动化小程序上传脚本，仍需通过微信开发者工具上传
- 长图能力为前端本地生成，不依赖新增后端接口
