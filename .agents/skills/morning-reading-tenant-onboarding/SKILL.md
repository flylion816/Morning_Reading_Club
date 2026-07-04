---
name: morning-reading-tenant-onboarding
description: Use when onboarding or troubleshooting a new tenant for the 七个习惯晨读营 WeChat mini program, including new AppID tenants, tenant config sync, upload issues, login/AppSecret errors, subscribe template problems, brand theme color cleanup, or tenant-scoped course/period initialization.
---

# 晨读营新租户开通

## Core Rules

- Work in the repo root: `/Users/lion/Nutstore Files/我的坚果云/flylion/AI项目开发/七个习惯晨读营`.
- Follow `AGENTS.md`: do not run `backend/scripts/init-mongodb.js` or any full database reset/init script.
- Course/period setup must be tenant-scoped. Prefer `backend/scripts/init-tenant-periods.js <slug> --dry-run` then `--execute`.
- Never commit upload keys, AppSecret, admin passwords, payment API keys, or private `.pem` files.
- AppSecret must live in the online tenant record at `wechatLogin.appSecret`; the code upload key is a separate `.pem` file.
- Subscribe template IDs must be synchronized in three places: backend static fallback config, online tenant `subscribeTemplates`, and generated miniprogram tenant/current config.
- Brand theme work must include a sweep for legacy hardcoded colors in real runtime pages/components, not just the obvious home page.
- After running tenant apply/upload, leave the local generated state intentionally:
  - if user is debugging the new tenant, keep `<slug>` applied;
  - otherwise run `npm run tenant:reset`.
- For local DevTools tenant switching, prefer `npm run tenant:switch`: input a slug to switch there, or press Enter to return to the default `fanren` tenant.
- If an online admin UI change is not visible, treat it as a deploy/cache question first: verify deployment, generated asset hash, and hard refresh before changing backend logic.
- For admin switches/toggles, distinguish "changed in page state" from "saved to backend" by checking for the expected `PUT` request and persisted database value.
- Before claiming completion, verify with current command output.

## Intake Checklist

Collect or confirm these items. If the user does not have one yet, explain where to get it and continue with available work.

| Item | Needed For | Notes |
| --- | --- | --- |
| `slug` | local config, backend tenant | lowercase, stable, e.g. `starry` |
| Brand name | UI and backend tenant | e.g. `若星生活家` |
| Mini program AppID | build/upload/login | `wx...` |
| AppSecret | backend WeChat login | not the upload key |
| Logo/source image | tenant assets and color | sample main color from logo if requested |
| Primary color | theme | write hex such as `#448426` |
| WeChat Pay mchId | payment | screenshot can confirm association |
| Subscribe template IDs | notifications | map to fanren's scene keys when names match |
| Business-domain TXT | domain verification | upload to `https://wx.shubai01.com/<file>.txt` |
| Code upload key | `miniprogram-ci` upload | from WeChat MP, store as `miniprogram/keys/<slug>.key.pem` |
| Admin account | sync tenant config | backend admin/superadmin email/password, not WeChat account |
| Course/period plan | initial content | can use tenant-scoped default initialization |

## WeChat Platform Setup

Guide the user through these platform-side items:

- Server/request/download/upload/business domains: usually set to `https://wx.shubai01.com` as required by the MP console.
- Business-domain TXT verification: place the provided TXT file on the server and verify public URL content.
- WeChat Pay: confirm the mini program has associated the expected `mchId`.
- Subscribe messages: create/collect template IDs and map them to the local scene keys.
- Mini program plugin: enable mini program plugin capability and add WechatSI:
  - plugin provider AppID: `wx069ba97219f66d99`
  - plugin name usually shown as `微信同声传译` / `WechatSI`
- Code upload key:
  - WeChat MP path: 开发 -> 开发管理 -> 开发设置 -> 小程序代码上传.
  - Download private key and place it as `miniprogram/keys/<slug>.key.pem`.
  - If upload reports `invalid ip`, add the reported public IP to the code-upload key IP whitelist. This is separate from AppSecret IP whitelist.

## Local Tenant Configuration

Use existing tenant patterns:

- Add `miniprogram/config/tenants/<slug>.js`.
- Add assets under `miniprogram/assets/tenants/<slug>/`:
  - `logo.png`
  - `share-cover.jpg`
  - `tab-home.png`, `tab-home-active.png`
  - `tab-book.png`, `tab-book-active.png`
  - `tab-my.png`, `tab-my-active.png`
- Update ignore rules if needed so unused tenant asset folders do not bloat uploads.
- Add static subscribe template fallback in `backend/src/config/subscribe-templates.config.js` for both:
  - `<slug>`
  - `<wxAppId>`
- Use the same scene keys as `fanren` when the new tenant's template names match.
- Place upload key:
  - `mkdir -p miniprogram/keys`
  - copy the provided key to `miniprogram/keys/<slug>.key.pem`
  - `chmod 600 miniprogram/keys/<slug>.key.pem`
  - verify `git check-ignore -v miniprogram/keys/<slug>.key.pem`.

Do not paste secrets into final answers. If a terminal command accidentally echoes a password, patch the script to pass secrets through environment variables instead of visible command args.

Scripts and helpers must not contain production credentials or hardcoded production database URLs. Tenant-scoped scripts may fall back to local development URLs, but production runs must require `MONGODB_URI`, the server `.env`, or an explicit `--mongo-uri`.

## Backend Admin Tenant

The backend tenant must exist before upload sync:

- Admin page: `https://wx.shubai01.com/admin/tenants`.
- Superadmin can create or update the tenant.
- `Admin email/password` in upload flow means backend admin login used to read `/admin/tenants`; it is not WeChat MP login and not a tenant admin requirement.
- Tenant admin accounts are for business operators later; not required for code upload.
- Required tenant fields:
  - `slug`, brand/name, enabled status
  - `wxAppIds` containing the new `wx...` AppID
  - `wechatLogin.appId` equal to the new AppID
  - `wechatLogin.appSecret` set to the new mini program AppSecret
  - `subscribeTemplates` filled with target AppID template IDs
  - branding primary color and WeChat Pay `mchId` when payment is enabled
- Editing with a blank AppSecret field usually means "do not modify"; when fixing a missing/wrong secret, re-enter it deliberately.
- Do not assume similarly named legacy UI fields map to `wechatLogin.appSecret`. Verify the saved tenant record, masking secrets in output.

## Subscribe Template Sync

New template IDs are not enough until all config sources agree:

1. Map the target mini program's template IDs to the same scene keys used by `fanren`.
2. Add/update backend static fallback in `backend/src/config/subscribe-templates.config.js` for `<slug>` and `<wxAppId>`.
3. Update the online tenant record `subscribeTemplates`.
4. Sync/apply miniprogram tenant config:
   ```bash
   npm run tenant:switch -- <slug>
   ```
5. Verify generated config:
   ```bash
   node - <<'NODE'
   const p = require('./project.config.json');
   const t = require('./miniprogram/config/current-tenant');
   const count = Object.values(t.subscribeTemplates || {}).filter(Boolean).length;
   console.log(p.appid, t.slug, t.wxAppId, t.primaryColor, count);
   NODE
   ```

If `requestSubscribeMessage` fails with an empty `templateId`, the current build has empty templates; fix config sync and re-upload. If `templateId` is non-empty, check that the template belongs to the target AppID and is approved in that mini program.

Frontend code should skip empty subscribe scenes instead of calling `wx.requestSubscribeMessage` with `""`; keep or add tests for this guard when touching subscription logic.

## WeChat Login Credential Sync

Symptom:

- `POST /api/v1/auth/wechat/login` returns 401.
- Server logs contain WeChat `errcode 40125 invalid appsecret` or "AppSecret错误或不属于当前小程序".

Diagnosis:

- Backend found the tenant/AppID, but `wechatLogin.appSecret` is missing, wrong, or belongs to another AppID.
- This is unrelated to the code upload key and unrelated to the code-upload IP whitelist.

Fix:

1. Inspect only the target tenant and select `+wechatLogin.appSecret`; print masked presence/length/hash, never the secret itself.
2. Update only that tenant's `wechatLogin.appId` and `wechatLogin.appSecret`.
3. Reload/deploy backend if code changed; no database reset.
4. Ask the user to retry login after clearing data or recompiling so `wx.login` creates a fresh code.

## Business-Domain TXT Upload

If the user provides a TXT verification file:

1. Inspect its filename and content.
2. Upload it to server, usually under `/var/www/morning-reading/wechat-verify/`.
3. Add or reuse an exact Nginx location:
   ```nginx
   location = /FILE.txt {
       default_type text/plain;
       alias /var/www/morning-reading/wechat-verify/FILE.txt;
   }
   ```
4. Run `sudo nginx -t` and reload if needed.
5. Verify:
   ```bash
   curl -fsSL https://wx.shubai01.com/FILE.txt
   ```

If `nginx -t` warns about duplicate `server_name wx.shubai01.com` but the exact URL returns 200 and content matches, report the warning as existing config debt rather than blocking verification.

## Upload Flow

Before upload:

```bash
npm run tenant:apply -- <slug>
npm run tenant:reset
npm test -- miniprogram/__tests__/config/multi-tenant.spec.js miniprogram/__tests__/utils/subscribe-auto-topup.spec.js --runInBand
npm run tenant:apply -- <slug>
```

Upload:

```bash
./upload-miniapp-tenant.command <slug>
```

Prompts:

- Version: user-facing dev version in WeChat MP, e.g. `0.01`.
- Upload description: e.g. `初始化版本`.
- Admin API base URL: press Enter for `https://wx.shubai01.com/api/v1` unless using local/test backend.
- Admin email/password: backend admin/superadmin credentials.

Common upload errors:

- `invalid ip: x.x.x.x`: add that IP to code-upload key IP whitelist in WeChat MP. This is not the AppSecret whitelist.
- `get plugin(... wx069ba97219f66d99 ...) failed, permission deny`: add/approve WechatSI plugin for the target mini program.
- `privateKeyPath` missing: key is not placed at `miniprogram/keys/<slug>.key.pem`.
- Wrong appId in devtools/upload: run `npm run tenant:apply -- <slug>` and confirm `project.config.json` `appid`.
- Local tenant switch for DevTools:
  - `npm run tenant:switch` then press Enter to use default `fanren`.
  - `npm run tenant:switch -- <slug>` or input `<slug>` at the prompt to switch to a target tenant.
  - Recompile and clear cache in WeChat DevTools after switching.
- `requestSubscribeMessage:fail No template data return...`: verify generated `subscribeTemplates` count, online tenant `subscribeTemplates`, and that the IDs belong to the target AppID.

After successful upload:

- WeChat MP shows developer as `ci机器人1`; this is normal for `miniprogram-ci`.
- Set dev version as experience version for phone testing.
- Submit review only after smoke testing.
- Local config changes do not affect already-uploaded versions; re-upload after changing template IDs, AppID, theme, assets, or generated config.

## Admin Operations And Home Config

Homepage section order/visibility is tenant-scoped:

- Admin page: `https://wx.shubai01.com/admin/home-config`.
- The tenant selector must point at the target tenant before editing.
- "隐藏/显示" should persist immediately. If the user reports that it reverts after refresh, inspect evidence before changing code:
  ```bash
  ssh -i ~/.ssh/id_ed25519 ubuntu@118.25.145.179 \
    "sudo grep 'home-config' /var/log/nginx/access.log | tail -n 80"
  ```
- Root-cause interpretation:
  - `GET /api/v1/home-config/admin` only: the page reloaded config, but no save reached backend.
  - `PUT /api/v1/home-config/admin` with 2xx: save reached backend; inspect tenant-scoped `HomeConfig.hiddenSections`.
  - `PUT` with 4xx/5xx: read the response/logs and fix that error first.
- For miniprogram behavior, public `GET /api/v1/home-config` should omit hidden sections. If a hidden section still appears in an uploaded mini program, re-upload the mini program so the client-side defensive filter is included.
- For new admin interactions that look like direct actions, prefer immediate save plus success/failure feedback. Keep a separate "保存" button for batch order changes.

## Theme And Runtime Color Sweep

After choosing a primary color:

1. Put the color in tenant config and generated theme variables.
2. Use CSS variables in WXSS, such as `var(--theme-primary)`, `--theme-primary-light`, `--theme-primary-tint`, and alpha variants generated by `miniprogram/scripts/apply-tenant.js`.
3. Use `miniprogram/utils/theme.js` for JS/WXML dynamic colors.
4. Search runtime files for legacy fanren blue and update real page/component usage:
   ```bash
   rg -n "#4a90e2|#357abd|rgba\\(74,\\s*144,\\s*226|#2f7ed8|#e8f4fd|#bdd4ef|#b8d9fb" \
     miniprogram/pages miniprogram/components miniprogram/utils miniprogram/services \
     -g '*.wxss' -g '*.wxml' -g '*.js'
   ```

It is acceptable for `miniprogram/utils/theme.js` to keep `DEFAULT_PRIMARY_COLOR = '#4a90e2'` as a fallback, and for explicit legacy-color detection constants to remain when used only to normalize old user data.

## Tenant-Scoped Course/Period Initialization

Use only the tenant-scoped script:

```bash
# on server
cd /var/www/morning-reading
NODE_ENV=production node backend/scripts/init-tenant-periods.js <slug> --dry-run
NODE_ENV=production node backend/scripts/init-tenant-periods.js <slug> --execute
```

If the script was changed locally but not deployed, copy only that script to the server before running.

Expected default output for a fresh tenant:

- 4 periods:
  - `平衡之道`
  - `勇敢的心`
  - `能量之泉`
  - `静心之镜`
- 23 sections per period.
- `平衡之道` has real Day 0-22 content.
- Other periods have placeholder sections.
- Tenant-specific data must show the target tenant ID.

The script should be idempotent: rerun should update existing periods/sections, not duplicate them.

## Verification Checklist

Use concrete evidence:

- Local generated tenant:
  ```bash
  npm run tenant:switch
  node -e "const p=require('./project.config.json'); const t=require('./miniprogram/config/current-tenant'); console.log(p.appid, t.brandName, t.wxAppId, t.primaryColor)"
  ```
- Subscribe template count:
  ```bash
  node - <<'NODE'
  const t = require('./miniprogram/config/current-tenant');
  console.log(t.slug, Object.values(t.subscribeTemplates || {}).filter(Boolean).length);
  NODE
  ```
- Key safety:
  ```bash
  git check-ignore -v miniprogram/keys/<slug>.key.pem
  ```
- Secret safety before committing:
  ```bash
  git diff --cached | rg -n "BEGIN (RSA )?PRIVATE KEY|AppSecret|MONGODB_URI=.*://.*:.*@|JWT_SECRET=.*[A-Za-z0-9]{20,}|WECHAT_.*SECRET"
  git diff --cached --name-only | rg -n "(^|/)\\.env($|\\.)|\\.pem$|\\.key$|credentials|secrets"
  ```
  Investigate any hit. Do not commit AppSecret, upload private keys, `.env`, or production database credentials.
- Tests:
  ```bash
  npm run tenant:reset
  npm test -- miniprogram/__tests__/config/multi-tenant.spec.js miniprogram/__tests__/utils/subscribe-auto-topup.spec.js --runInBand
  npm run tenant:apply -- <slug> # only if user wants to keep debugging new tenant
  ```
- Hardcoded legacy color sweep:
  ```bash
  rg -n "#4a90e2|#357abd|rgba\\(74,\\s*144,\\s*226|#2f7ed8|#e8f4fd|#bdd4ef|#b8d9fb" miniprogram/pages miniprogram/components miniprogram/utils miniprogram/services -g '*.wxss' -g '*.wxml' -g '*.js'
  ```
- Online period list by AppID:
  ```bash
  curl -sS -H 'X-Wx-AppId: <wxAppId>' 'https://wx.shubai01.com/api/v1/periods?limit=10'
  ```
- Section count for each period:
  ```bash
  curl -sS -H 'X-Wx-AppId: <wxAppId>' 'https://wx.shubai01.com/api/v1/sections/period/<periodId>'
  ```
- Admin release verification:
  ```bash
  curl -sS https://wx.shubai01.com/admin/home-config | head -c 600
  curl -sS https://wx.shubai01.com/api/v1/health | head -c 300
  ```
  If the user still sees old admin UI after deploy, ask for `Cmd+Shift+R` or an incognito window. Confirm the HTML references the new hashed asset, such as `/admin/assets/index-*.js`.

For final smoke testing, ask the user to verify:

- DevTools or experience version opens with the new brand/theme.
- Login works for the new AppID.
- Period list and section detail load.
- Enrollment/payment entry behaves as expected.
- Subscribe message prompt uses the new templates.
- WechatSI text-to-speech pages do not fail.

## Deployment And Remote Sync

If local backend files changed and online behavior depends on them:

- Copy only the changed backend file(s) to the server.
- Make a timestamped backup before overwriting.
- Reload the PM2 backend:
  ```bash
  pm2 reload morning-reading-backend --update-env
  ```
- Verify PM2 status and one relevant API behavior.

If admin frontend files changed, a backend-only copy is not enough. Run the deploy flow that rebuilds and replaces `admin/dist`, then verify the admin HTML and the new hashed bundle. Browser cache can make a normal refresh show stale UI.

Avoid printing secrets in deploy logs. If inspecting tenant credentials, show only masked presence, length, or hash.

## Git And Handoff

- Keep `miniprogram/keys/<slug>.key.pem` ignored and untracked.
- Do not commit while user is still testing unless explicitly asked.
- Commit candidates usually include:
  - tenant config and assets
  - backend subscribe template fallback
  - upload script privacy fix
  - tenant-scoped initialization script
  - any docs updates
- Mention generated-state files carefully: `project.config.json`, `miniprogram/app.json`, `miniprogram/config/current-tenant.js`, and `miniprogram/theme.wxss` may reflect the currently applied tenant. Decide whether to commit canonical/default state or reset before committing based on existing repo convention.
