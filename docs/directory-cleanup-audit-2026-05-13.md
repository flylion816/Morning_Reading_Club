# 目录清理与规整确认清单（2026-05-13）

## 结论先行

本次只做审计和确认清单，未删除任何文件，未运行数据库初始化/重置脚本。

建议不要一次性大扫除。当前目录里混有源码、运行配置、历史文档、一次性修复脚本、构建产物、日志和备份文件。为了不影响小程序和后端运行，建议分 4 批处理：

1. 先清理本地生成物和日志，不改 Git 历史。
2. 再删除明确无引用的一次性脚本和 Vue 模板遗留文件。
3. 单独处理敏感配置和备份文件，必要时先轮换密钥。
4. 最后合并文档和脚本体系，避免把开发指南、部署脚本、历史报告混在一起。

## 审计依据

已检查：

- `git status --short`：开始审计时工作区干净。
- `git ls-files`：确认哪些文件被 Git 跟踪。
- `git ls-files --others --ignored --exclude-standard`：确认本地忽略文件。
- `find . -maxdepth 2/3`：扫描目录、产物、日志、备份和临时文件。
- `rg`：检查文件名、脚本名、组件名、图片名是否被源码、脚本、文档引用。
- `package.json`、`backend/package.json`、`admin/package.json`：检查脚本入口和运行依赖。
- `miniprogram/app.json`、`admin/src/router/index.ts`：检查小程序页面入口和管理后台路由入口。

未执行：

- 未删除文件。
- 未改运行代码。
- 未执行 `backend/scripts/init-*.js`、`restore-*`、`reset-*` 等数据库/账号脚本。

## A. 可以直接清理的本地生成物（不建议提交删除，只做本机清理）

这些文件/目录不参与源码运行，可由安装、构建、测试或运行时重新生成。删除后可能需要重新安装依赖或重新构建。

| 路径 | 类型 | 依据 | 建议 |
| --- | --- | --- | --- |
| `node_modules/` | 根依赖 | 根 `package.json` 可重装 | 可本地删除，之后运行 `npm install` 或 `npm ci` |
| `admin/node_modules/` | 管理后台依赖 | `admin/package.json` 可重装 | 可本地删除，之后在 `admin/` 运行 `npm install` |
| `backend/node_modules/` | 后端依赖 | `backend/package.json` 可重装 | 可本地删除，之后在 `backend/` 运行 `npm install` |
| `admin/dist/` | Vite 构建产物 | `admin npm run build` 可生成；当前为 ignored | 可本地删除，不影响源码 |
| `coverage/` | 小程序 Jest 覆盖率 | 根 `npm run test:miniprogram -- --coverage` 可生成 | 可本地删除 |
| `backend/coverage/` | 后端 nyc 覆盖率 | `backend npm run test:coverage` 可生成 | 可本地删除 |
| `backend/.nyc_output/` | nyc 中间产物 | 覆盖率工具生成 | 可本地删除 |
| `logs/` | 根日志 | `.gitignore` 已忽略 | 可本地删除 |
| `backend/logs/` | 后端运行日志 | `.gitignore` 已忽略；占用较大 | 可本地删除，运行后会再生成 |
| `miniprogram/assets/.DS_Store` | macOS 系统文件 | 未被 Git 跟踪，且 `.gitignore` 已忽略 `.DS_Store` | 可本地删除 |
| `.cloudbase/container/debug.json` | 云开发调试状态 | `.cloudbase/` 已在 `.gitignore` 中 | 可本地删除，除非正在使用云开发调试 |

确认项：

- [ ] 同意清理本机生成物和日志。
- [ ] 清理后允许重新安装依赖、重新构建或重新跑测试覆盖率。

## B. 明确无运行引用，建议删除或归档的文件

这些文件不在 package 脚本、后端入口、小程序入口或管理后台路由中被引用。删除前建议先确认是否还需要保留历史排障价值。

### B1. 根目录一次性修复脚本

这些脚本都是直接改写 `miniprogram/pages/course-detail/course-detail.js/wxml` 的临时修复脚本，当前没有任何源码或 package 脚本引用：

- `fix_avatar_js.py`
- `fix_likes.js`
- `fix_likes_js.py`
- `fix_likes_js2.py`
- `fix_wxml.js`
- `fix_wxml2.js`
- `fix_wxml3.js`
- `fix_wxml4.py`
- `fix_wxml5.py`
- `fix_wxml6.py`
- `fix_wxml7.py`
- `fix_wxml8.py`
- `fix_wxml_dup.js`
- `rewrite_wxml.py`

风险判断：低。它们不是运行依赖，但属于历史修复脚本。建议删除前确认相关修复已在源码和测试中覆盖。

建议：

- [ ] 删除上述一次性修复脚本。
- [ ] 或移动到 `docs/history/scripts/` 只做历史留档。

### B2. 零散数据库/排查脚本

| 路径 | 发现 | 风险 | 建议 |
| --- | --- | --- | --- |
| `test_db.js` | 直接连接本地 MongoDB 查询点赞数据 | 低到中；不是运行入口，但会连真实本地库 | 建议删除或移入 `docs/history/scripts/` |
| `backend/test_likes.js` | 查询 `Checkin.likes` 并打印 | 低到中；不是 package 脚本 | 建议删除或归档 |
| `backend/check_enrollments.js` | 连接数据库并打印报名数据 | 中；会访问真实库 | 建议移入 `backend/scripts/diagnostics/` 或删除 |
| `backend/create-admin-local.js` | 删除并创建默认管理员 | 高；包含 `deleteOne` 和默认密码 | 不建议保留在根 `backend/`，若保留需改名到 `backend/scripts/manual/` 并加危险提示 |
| `backend/create-admin-correct.js` | 删除并创建默认管理员 | 高；包含 `deleteOne` 和默认密码 | 同上，建议删除或归档，不应作为常规工具 |
| `backend/hash_password.js` | 生成默认密码 hash | 低；但引用 `bcrypt`，当前依赖是 `bcryptjs` | 建议删除或改成文档说明 |

确认项：

- [ ] 同意删除/归档这些零散脚本。
- [ ] 对 `create-admin-*` 这类会改数据的脚本，要求以后只能在明确确认后执行。

### B3. 管理后台 Vue 模板遗留文件

管理后台路由 `admin/src/router/index.ts` 未引用 `HomeView` 和 `AboutView`；生产入口只渲染 `RouterView`。以下文件属于 Vite/Vue 初始模板或只被模板文件互相引用：

- `admin/src/views/HomeView.vue`
- `admin/src/views/AboutView.vue`
- `admin/src/components/HelloWorld.vue`
- `admin/src/components/TheWelcome.vue`
- `admin/src/components/WelcomeItem.vue`
- `admin/src/components/icons/IconCommunity.vue`
- `admin/src/components/icons/IconDocumentation.vue`
- `admin/src/components/icons/IconEcosystem.vue`
- `admin/src/components/icons/IconSupport.vue`
- `admin/src/components/icons/IconTooling.vue`
- `admin/src/stores/counter.ts`
- `admin/src/stores/__tests__/counter.spec.ts`

风险判断：低到中。删除这些文件不影响当前路由，但会减少一个测试文件，需同步确认 Vitest 测试数量变化。

建议：

- [ ] 删除 Vue 模板遗留文件。
- [ ] 删除后运行 `cd admin && npm run type-check && npm test -- --run && npm run build`。

## C. 需要修复或规整的“无效/半无效”引用

### C1. 根 `package.json` 有无效脚本

`package.json` 中存在：

```json
"convert-icons": "node scripts/convert-icons.js"
```

但 `scripts/convert-icons.js` 不存在。

建议二选一：

- [ ] 删除 `convert-icons` 脚本。
- [ ] 或补回 `scripts/convert-icons.js`，并明确它是否还用于生成小程序 tabBar 图标。

### C2. 通知徽章组件引用缺失图片

`miniprogram/components/notification-badge/notification-badge.wxml` 引用：

```xml
src="/assets/icons/bell.png"
```

但 `miniprogram/assets/icons/bell.png` 不存在。同时当前页面 JSON 中没有注册 `notification-badge` 组件，说明它目前可能未启用。

建议二选一：

- [ ] 如果未来要用通知徽章：补 `bell.png`，并在需要的页面注册组件。
- [ ] 如果不再使用：删除 `miniprogram/components/notification-badge/`，同时确认没有计划复用。

### C3. 小程序图标源文件可规整

小程序 tabBar 使用的是 PNG：

- `home.png`
- `home-active.png`
- `book.png`
- `book-active.png`
- `my.png`
- `my-active.png`

SVG 文件没有运行时引用，主要像是源图：

- `home.svg`
- `home-active.svg`
- `book.svg`
- `book-active.svg`
- `user.svg`
- `user-active.svg`

注意：`user.png/user-active.png` 当前不在 `app.json` tabBar 使用，但 README 仍把它们作为“我的”图标示例；当前实际使用 `my.png/my-active.png`。

建议：

- [ ] 保留 SVG 作为设计源文件，但移动到 `docs/assets/source-icons/` 或在 README 说明用途。
- [ ] 或删除未使用 SVG，只保留小程序运行所需 PNG。
- [ ] 更新 `miniprogram/assets/README.md`，把 `user`/`my` 的实际用途写清楚。

## D. 敏感配置和备份文件：不要直接删，需单独处理

这些文件对运行或部署有影响，且包含真实或疑似真实密钥/密码。建议单独开一次安全清理，不和普通目录整理混在一起。

| 路径 | 状态 | 问题 | 建议 |
| --- | --- | --- | --- |
| `.env.config.js` | Git 跟踪 | 包含生产 MongoDB/MySQL/Redis/JWT/微信/管理员密码配置 | 不要直接删；应迁移为 `.env.config.example.js` + 本地 `.env.config.local.js`，并轮换已提交过的密钥 |
| `.env.docker` | Git 跟踪 | 包含生产级密码和 JWT/微信 secret | 从 Git 移出，改为生成文件或示例文件 |
| `.env.prod` | Git 跟踪 | 包含生产级密码和 JWT/微信 secret | 从 Git 移出，改为 `.env.prod.example` |
| `.backup/.env.production.backup.20260226_103916` | Git 跟踪 | 文件内写明“不应提交到 Git”，且包含生产配置 | 从 Git 移出；真实密钥需视为已泄露并轮换 |
| `scripts/generate-env-production.js` | Git 跟踪 | 硬编码 JWT secret、微信 secret、生产密码模板 | 改成读取本地 secret，不在脚本里写真实密钥 |
| `admin/.env.production` | Git 跟踪且被 `.gitignore` 忽略 | 只含 `VITE_API_URL`，敏感性低，但跟 `.gitignore` 策略矛盾 | 若只是公开 API URL，可改名为 `.env.production.example` 或从 ignore 规则中明确例外 |
| `backups/db_backup_20251207_105446.tar.gz` | Git 跟踪 | 数据库备份文件可能含真实数据 | 建议从 Git 移出并放到安全备份介质 |
| `backups/db_backup_20251207_105505.tar.gz` | Git 跟踪 | 数据库备份文件可能含真实数据 | 同上 |
| `admin/dump.rdb` | Git 跟踪 | Redis dump，可能含运行数据 | 建议从 Git 移出 |

重要提醒：

- 这些文件不建议只做 `git rm` 就结束。因为密钥/备份已经进入 Git 历史，真正安全做法是先轮换所有相关密钥、密码和 token。
- `.env.config.js` 当前被 `scripts/generate-env-production.js` 和后端启动配置读取，不能在没有替代方案前删除。

确认项：

- [ ] 同意单独做一次“敏感配置脱敏与密钥轮换”任务。
- [ ] 同意先设计替代配置方案，再移除真实 env/backup 文件。
- [ ] 同意对已提交过的生产密钥做轮换。

## E. 可以合并或归档的文档

当前文档量很大，且存在多代版本、执行总结和历史报告并存。文档不影响运行，但会影响维护效率。

### E1. `AGENTS.md` 与 `CLAUDE.md`

两者约 991 行，内容高度相似，但存在路径体系差异：

- `CLAUDE.md` 指向实际存在的 `.claude/`。
- `AGENTS.md` 指向不存在的 `.Codex/`。
- 当前 Codex 会读取 `AGENTS.md`，因此不能直接删除。

建议：

- [ ] 保留 `AGENTS.md`，但把其中 `.Codex/` 路径修正为 `.claude/`，或明确创建 `.Codex -> .claude` 的兼容方案。
- [ ] 保留 `CLAUDE.md` 作为 Claude Code 入口。
- [ ] 后续用一个模板生成两份入口文档，避免继续漂移。

### E2. `.claude/`、`.omc/`、`admin/.claude/`

| 路径 | 判断 | 建议 |
| --- | --- | --- |
| `.claude/` | 当前实际工具、命令、memory、agents 都在这里 | 暂保留 |
| `.omc/` | 看起来是另一套本地会话/状态/checkpoint | 若不再使用 OMC，可归档或删除；不影响小程序/后端运行 |
| `admin/.claude/` | 管理后台测试审查报告 | 可移到 `docs/history/admin/` |

### E3. `docs/` 多版本文档

建议按用途规整：

- `docs/guides/`：保留当前开发、部署、测试、安全指南。
- `docs/backend/`：保留当前代码同步版和 v4 版；v3 版移入 `docs/history/backend-v3/`。
- `docs/history/`：继续作为历史报告归档区。
- `docs/plans/`：只保留仍未完成或可执行的计划，已完成计划移入 `docs/history/plans/`。
- `scripts/*.md`：部署脚本文档可合并到 `docs/guides/SCRIPTS_GUIDE.md` 或 `docs/guides/DEPLOY_INSTRUCTIONS.md`，避免 `scripts/` 同时放可执行脚本和长文档。

确认项：

- [ ] 同意按“当前指南 / 历史归档 / 计划草案 / 脚本文档”重排文档。
- [ ] 同意先只移动文档，不改代码。

## F. 脚本体系需要规整，但不能直接删除

当前至少有三类脚本：

- 根 `scripts/`：部署、服务器初始化、生成 env、恢复、验证。
- `.claude/commands/`：开发/测试/部署快捷命令。
- `backend/scripts/`：数据库初始化、迁移、报表、诊断、恢复。

建议：

- `backend/scripts/init-*`：保留，但标注危险级别；任何会清空/初始化数据库的脚本必须用户明确确认后执行。
- `backend/scripts/*.json` 课程内容：保留，`init-23-days.js` 等初始化脚本可能依赖。
- `scripts/1-*.sh` 和 `scripts/deploy-*.sh`：保留，部署文档大量引用。
- `scripts/fix_base64_images.py`、`scripts/fix_broken_img_tags.py`：如果只用于一次性修复富文本图片，建议移动到 `scripts/manual/` 并写明用途。
- `scripts/server/*.sh`：保留，部署脚本会复制/调用。
- `.claude/commands/*`：保留，当前文档和工具体系大量引用。

确认项：

- [ ] 同意把一次性脚本移动到 `scripts/manual/`。
- [ ] 同意给危险脚本加 README 和执行确认提示。

## G. 测试体系可以规整

当前测试体系：

- 后端：`backend/tests/`，当前有效。
- 小程序：`miniprogram/__tests__/`，当前有效。
- 管理后台：`admin/src/**/__tests__/`，当前有效。
- Python Playwright E2E：`tests/e2e/`，有 README 和脚本引用。
- Cypress E2E：`cypress/e2e/admin-dashboard.cy.js`，但当前 package scripts 和依赖中未看到 Cypress 执行入口。

建议：

- [ ] 保留前三类单元/集成测试。
- [ ] 保留 `tests/e2e/`，但把默认密码改为从环境变量读取且文档强调不可使用生产密码。
- [ ] 对 `cypress/` 做二选一：补回 Cypress 依赖和 `test:e2e` 脚本，或移到 `docs/history/e2e-cypress/`。

## H. 建议的处理顺序

### 第 1 批：本地清理，不改代码

目标：释放空间，不影响 Git，不影响运行。

- 删除 `node_modules/`、`admin/node_modules/`、`backend/node_modules/`。
- 删除 `admin/dist/`、`coverage/`、`backend/coverage/`、`backend/.nyc_output/`。
- 删除 `logs/`、`backend/logs/`。
- 删除 `.DS_Store`。

验证：

- 重新安装依赖后运行：
  - `npm run test:miniprogram -- --runInBand`
  - `cd backend && npm test`
  - `cd admin && npm run type-check && npm test -- --run && npm run build`

### 第 2 批：低风险 Git 清理

目标：删除无运行引用的历史脚本和模板遗留文件。

- 删除或归档根目录 `fix_*`、`rewrite_wxml.py`、`test_db.js`。
- 删除或归档 `backend/test_likes.js`、`backend/check_enrollments.js`、`backend/create-admin-*.js`、`backend/hash_password.js`。
- 删除管理后台 Vue 模板遗留文件和 `counter` 示例 store。
- 处理 `convert-icons` 无效脚本。
- 处理 `notification-badge` 缺失图片/未启用组件。

验证：

- `npm run test:miniprogram -- --runInBand`
- `cd backend && npm run lint && npm test`
- `cd admin && npm run type-check && npm test -- --run && npm run build`

### 第 3 批：敏感配置清理

目标：把真实密钥、真实备份从 Git 中移出，并轮换已暴露密钥。

- 设计 `.env.example` / `.env.local` / `.secrets/` 方案。
- 修改 `scripts/generate-env-production.js`，不再硬编码真实 secret。
- 移出 `.env.docker`、`.env.prod`、`.backup/*`、`backups/*.tar.gz`、`admin/dump.rdb`。
- 轮换 JWT、微信、MongoDB、MySQL、Redis、管理员默认密码。

验证：

- 本地 dev 能启动后端。
- 管理后台能连接 API。
- 生产部署脚本仍能从安全来源生成 env。

### 第 4 批：文档和脚本规整

目标：降低长期维护成本，不改变运行逻辑。

- 修正 `AGENTS.md` 的 `.Codex` 失效路径。
- 合并 `scripts/*.md` 到 `docs/guides/`。
- 归档 v3/历史/完成报告类文档。
- 建立 `docs/README.md` 或更新 `docs/DOCUMENTATION-MATRIX-2026-05-12.md`。

验证：

- 链接检查：至少用 `rg` 确认移动后的路径被同步更新。
- 不需要跑全量测试，但建议跑 `git diff --check`。

## 需要你确认的问题

请确认以下决策，我再执行实际删除/移动：

- [ ] 是否先执行第 1 批本地清理？
- [ ] 根目录一次性 `fix_*` / `rewrite_wxml.py` 脚本：删除，还是移动到 `docs/history/scripts/`？
- [ ] `backend/create-admin-*` 这类危险脚本：删除，还是移动到 `backend/scripts/manual/` 并加警告？
- [ ] 管理后台 Vue 模板遗留文件：是否删除？
- [ ] `notification-badge`：未来是否还要用？如果要用，我建议补 `bell.png`；如果不用，建议删除组件。
- [ ] 敏感配置和备份文件：是否同意单独开“密钥轮换 + env 脱敏”任务？
- [ ] `AGENTS.md` / `CLAUDE.md`：是否按当前真实目录 `.claude/` 统一修正？

## 明确不建议删除的运行关键路径

以下路径是当前小程序、后端、管理后台或测试的核心，不建议删除：

- `miniprogram/app.js`
- `miniprogram/app.json`
- `miniprogram/pages/`
- `miniprogram/services/`
- `miniprogram/utils/`
- `miniprogram/components/course-card/`
- `backend/src/`
- `backend/package.json`
- `backend/scripts/init-*.js`（危险但仍是部署/初始化工具，不能无替代删除）
- `backend/tests/`
- `admin/src/router/`
- `admin/src/views/` 中已在 router 注册的页面
- `admin/src/services/`
- `admin/src/stores/` 中业务 store
- `admin/package.json`
- `scripts/deploy-to-server.sh`
- `scripts/server/`
- `.claude/commands/`
- `.claude/memory/`
- `openspec/`

