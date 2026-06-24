## Context
目标是在 Mac 上做一个独立的“晨读观察台”：不控制腾讯会议客户端，也不依赖 Computer Use。第一版先支持用户把腾讯会议转写、截图 OCR、手动速记或聊天文本粘贴到不同发言人卡片中，系统对每个人单独抓本质、匹配本期七个习惯主题、推荐观察者个人经历和生成现场回应。等多位发言人都完成后，再合并成全场统一洞察和收束稿。

现有晨读营项目是微信小程序 + Node.js 后端 + Vue 管理后台，本方案不是对晨读营产品的功能扩展。为避免混淆，会议助手应作为独立产品验证，最多在当前仓库中临时放置 OpenSpec 和 P0 原型，正式开发建议独立仓库。

## Goals / Non-Goals
- 目标：支持多位发言人卡片，每位发言人可以多次粘贴片段、单独分析、单独生成回应。
- 目标：支持把不同输入来源统一进入发言人卡片，包括手动粘贴、剪贴板快捷键、截图 OCR 后文本、腾讯会议转写和后续音频转写。
- 目标：用本期主题作为全局锚点，让所有单人分析都围绕七个习惯主题，不让 AI 发散。
- 目标：用观察者个人故事库辅助回应，推荐适合关联的经历、适合说到的程度和不适合展开的细节。
- 目标：支持每个人的“单人反馈”与最后“全场合并洞察”分开生成。
- 目标：导出现场回应、全场总结、金句和会后复盘素材。
- 非目标：MVP 不做实时语音转录、不做腾讯会议插件、不做自动截图 OCR、不做多用户协作。
- 非目标：P0 不做腾讯会议官方插件、不上架腾讯会议应用市场、不操控腾讯会议 UI。
- 非目标：P0 不接入晨读营现有数据库、支付、登录、管理后台或小程序。

## Plugin Usage
- `Product Design`：设计晨读观察台的多人卡片、现场分析和全场合并交互。
- `GitHub`：后续创建或管理实现仓库，跟踪 P0、MVP、PR、CI 和发布流程。
- `Browser`：验证本地前端页面、Tauri WebView 页面或开发预览。
- `Documents`：生成正式技术方案、用户手册、会议纪要模板和对外说明文档。
- `Hugging Face`：仅在需要评估本地离线 ASR 模型时使用，例如 Whisper 类模型；不是第一优先级。
- `Computer Use`：不作为核心能力，仅在极少数需要操作本机授权窗口时人工辅助。

## Decisions
- 决策：第一版做观察者工作台，而不是语音转录产品。
  原因：现场关键瓶颈是“抓点和回应”，不是“有没有文字”。用户可以通过腾讯会议转写、截图 OCR 或速记获得足够输入。
- 决策：多发言人卡片是主界面核心，不采用聊天流。
  原因：观察者需要同时管理 4 位左右发言人的原文、状态、AI 观察、回应稿和是否已回应。
- 决策：每位发言人支持多个内容片段。
  原因：现场分享可能分多轮，也可能先粘贴速记、后补腾讯会议转写；系统需要保留片段来源和时间顺序。
- 决策：单人分析和全场合并分离。
  原因：现场先服务“马上回应某个人”，会后或最后再服务“统一收束全场”。
- 决策：每次 AI 输出必须包含“不要说的话”。
  原因：面对正在痛苦中的人，观察者需要避免诊断、评判、比较苦难和过度说教。
- 决策：语音采集、腾讯会议 webhook 和 ASR 都作为后续输入源。
  原因：这些能力能减少复制操作，但不能替代观察者工作流本身。

## Architecture
```text
Manual paste / clipboard / OCR / meeting transcript / future ASR
              |
              v
      Speaker Content Cards
              |
              v
      Theme Anchor + Story Library
              |
              v
      Single-speaker Insight Engine
              |
        +-----+-----+
        |           |
        v           v
  Live Response   Do-not-say Guardrails
        |           |
        +-----+-----+
              |
              v
      Whole-session Synthesis
              |
              v
      Final Summary / Review Library
```

## Recommended Stack
- Desktop shell: Electron + React + TypeScript for MVP; Tauri can be revisited after the workflow is stable.
- Input: manual paste and clipboard shortcut first; screenshot OCR, Tencent Meeting webhook and ASR later.
- Storage: local JSON or SQLite for sessions, speaker cards, content snippets, insights and review history.
- Secrets: macOS Keychain for ASR and LLM API keys.
- Analysis: LLM provider abstraction, prompt templates for single-speaker insight and whole-session synthesis.

## Data Shape
```ts
type ObserverSession = {
  id: string
  title: string
  themeId: string
  startedAt: string
  endedAt?: string
  observerStance: string
}

type SpeakerCard = {
  id: string
  sessionId: string
  name: string
  status: 'empty' | 'captured' | 'analyzed' | 'response_ready' | 'responded'
  displayOrder: number
}

type ContentSnippet = {
  id: string
  speakerId: string
  sourceType: 'manual_paste' | 'clipboard' | 'ocr_text' | 'meeting_transcript' | 'future_asr'
  text: string
  createdAt: string
}

type SpeakerInsight = {
  id: string
  speakerId: string
  strongestPoint: string
  underlyingPattern: string
  themeConnection: string
  stuckType: string // 兼容旧字段，展示为“看到的问题”
  seenNeed: string
  suggestedObserverStory: string
  oneMinuteResponse: string
  deepResponse: string
  powerfulQuestion: string
  goldenSentence: string
  doNotSay: string[]
  createdAt: string
}
```

## User Experience
- 入口：用户打开应用，先选择本期主题，例如“积极主动”。
- 布局：左侧是发言人列表，中间是当前发言人的内容片段和单人洞察，右侧是现场回应、追问和不要说的话。
- 粘贴：用户复制腾讯会议转写、字幕 OCR 或手动速记后，点击“粘贴到当前发言人”，或使用快捷键进入当前卡片。
- 单人：每个人可以多次粘贴内容，系统合并该人的片段后生成单人洞察和现场回应。
- 状态：发言人卡片显示未采集、已采集、已观察、回应已备好、已回应。
- 合并：用户可随时生成全场总结，但系统会提示哪些发言人还没有分析或回应。
- 会后：保存本期主题、每个人原文、AI 观察、实际回应、最终总结和可复用模式。

## P0 Verification Scope
P0 现在优先验证观察者工作流：
- 能创建一场观察者会话并锁定本期主题。
- 能创建多位发言人卡片。
- 能把多段文本粘贴到不同发言人。
- 能为单位发言人生成结构化洞察、现场回应和不要说的话。
- 能把多位发言人的分析合并成全场统一总结。

P0 不要求：
- 实时语音转写。
- 腾讯会议官方 API 集成。
- 自动截图 OCR。
- Word 导出。

## Risks / Trade-offs
- macOS 系统版本限制：Core Audio Process Tap 对系统版本有要求。缓解：P0 记录系统版本并提供 ScreenCaptureKit fallback。
- 权限复杂：系统音频和麦克风可能需要不同授权。缓解：启动时做权限检查和引导。
- 腾讯会议音频路由差异：不同设备、耳机和会议设置可能影响采集。缓解：P0 加输入/输出设备诊断。
- ASR 成本和延迟：实时转写会产生成本。缓解：支持按会议开启、暂停和本地保存；P0 输出延迟指标。
- 说话人识别不完整：远端多人第一版无法精准分离。缓解：先区分 self/remote，后续结合腾讯会议会后转写或说话人分离模型。
- 隐私合规：会议录音和转写敏感。缓解：默认本地存储，明确授权状态，支持一键删除会议数据。

## Rollout Plan
- P0：音频采集 + 实时 ASR 技术验证。
- P1：可用桌面界面，支持实时字幕、暂停、保存、选段洞察和 Markdown 导出。
- P2：多端合并，支持会后转写、手机录音、手动笔记和 Word 导出。
- P3：模板体系，支持客户会议、内部会议、日报、复盘、项目例会等输出模板。
- P4：企业化，支持团队空间、共享会议、权限、审计和长期知识库。

## Open Questions
- P0 首选 ASR 供应商是否固定为腾讯云，还是同时预留 OpenAI Realtime 备用？
- 用户当前 macOS 版本是否支持 Core Audio Process Tap；如果版本较低，是否接受 ScreenCaptureKit 或虚拟声卡方案？
- 是否需要第一版就输出 Word，还是 Markdown/复制文本即可？
- 是否需要把这个项目放在当前仓库作为实验目录，还是创建独立仓库？
