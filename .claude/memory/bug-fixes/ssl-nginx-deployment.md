# 🚀 SSL 证书和 Nginx 部署问题记录

> **发生时间**: 2025-12-14
> **问题类型**: 部署基础设施
> **影响范围**: 线上网站无法正常访问
> **解决时间**: ~1 小时

---

## 📋 问题概览

部署完成后网站出现两个关键问题：

1. **SSL 证书安全警告** - 浏览器显示"连接不安全"
2. **页面白屏 + 静态资源加载失败** - JavaScript 模块加载报 MIME 类型错误

---

## 🔴 问题 1：SSL 证书不被浏览器信任

### 症状
```
浏览器提示：
"您与此网站之间建立的连接不安全"
"请勿在此网站上输入任何敏感信息"
```

### 根本原因

使用的是**自签名证书**（Self-signed certificate）：

```
Issuer: C = CN, ST = Beijing, L = Beijing, O = Morning Reading, CN = wx.shubai01.com
Subject: C = CN, ST = Beijing, L = Beijing, O = Morning Reading, CN = wx.shubai01.com
         ↑ 发行者 = 颁布方 = 你自己，不是受信任的 CA
```

**为什么不安全**：
- 浏览器的信任链中没有"Morning Reading"这个 CA
- 自签名证书只能通过自己验证自己，无法第三方验证
- 浏览器无法确认这不是中间人攻击

### 解决方案

**使用 Let's Encrypt 申请免费证书**（被全球浏览器信任）

```bash
# 1. 停止 Nginx（Let's Encrypt 验证需要绑定 80 端口）
sudo systemctl stop nginx

# 2. 申请证书（standalone 模式）
sudo certbot certonly --standalone \
  -d wx.shubai01.com \
  --agree-tos \
  --no-eff-email \
  -m admin@shubai01.com \
  --non-interactive

# 3. 重启 Nginx
sudo systemctl start nginx
```

**证书位置**：
- 证书文件：`/etc/letsencrypt/live/wx.shubai01.com/fullchain.pem`
- 私钥文件：`/etc/letsencrypt/live/wx.shubai01.com/privkey.pem`

**更新 Nginx 配置**：

```nginx
# 旧配置（不要用）
ssl_certificate /etc/nginx/ssl/certificate.crt;          # ❌ 自签名
ssl_certificate_key /etc/nginx/ssl/private.key;

# 新配置（使用 Let's Encrypt）
ssl_certificate /etc/letsencrypt/live/wx.shubai01.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/wx.shubai01.com/privkey.pem;
```

**自动续期**：Certbot 已经配置了 cron 任务，证书会在过期前 30 天自动更新

```bash
# 验证自动续期任务
cat /etc/cron.d/certbot
```

### 验证结果

```bash
# 检查证书信息
openssl x509 -in /etc/letsencrypt/live/wx.shubai01.com/fullchain.pem -text -noout

# 输出应该显示：
# Issuer: C=US; O=Let's Encrypt; CN=E8  ✅ （被信任的 CA）
# Subject: CN=wx.shubai01.com
# Valid: 2025-12-14 至 2026-03-14
```

---

## ⚪ 问题 2：页面白屏 + JavaScript 加载失败（核心问题）

### 症状

```
浏览器控制台错误：
Failed to load module script: Expected a JavaScript-or-Wasm module script
but the server responded with a MIME type of "text/html".
Strict MIME type checking is enforced for module scripts per HTML spec.
```

**表现**：
- ✅ 首页 HTML 返回 200 OK
- ❌ 首页请求的 JavaScript 文件返回的是 HTML（而不是 JS）
- ❌ CSS 文件也返回 HTML

### 根本原因

**Nginx location 块匹配顺序问题**

原始配置：
```nginx
location /api/ { ... }

location /assets/ {                    # ❌ 优先级 4（最低）
    alias /var/www/.../assets/;
}

location ~ ^/admin/ {                  # ✅ 优先级 3（正则表达式）
    root /var/www/.../dist;
    try_files $uri /index.html;        # 关键：找不到就返回 index.html
}
```

**发生的过程**：

```
请求：GET /admin/assets/index-Bmd-qS6Y.js
      ↓
Nginx 匹配 location：
  1. /api/ ? ❌ 不匹配
  2. /assets/ ? ❌ 被下面的正则表达式跳过了
  3. ~ ^/admin/ ? ✅ 匹配！（进入这个 location）
      ↓
执行：try_files /admin/assets/index-Bmd-qS6Y.js /index.html
  • 找不到实际的文件
  • 回退到返回 /index.html
      ↓
浏览器收到：text/html（HTML 代码）
          而不是：application/javascript
      ↓
浏览器拒绝：strict MIME 类型检查失败 ❌
```

### 关键知识：Nginx Location 匹配优先级

```
优先级从高到低：
1️⃣  = 精确匹配        (location = /path)
2️⃣  ^~ 非正则前缀     (location ^~ /path)
3️⃣  ~ 正则表达式      (location ~ pattern)
4️⃣  普通前缀          (location /path)
```

**这很重要**：
- `location ~ ^/admin/` 是正则表达式（优先级 3）
- `location /assets/` 是普通前缀（优先级 4）
- 所以正则表达式先匹配，低优先级的 `/assets/` 永远不会被执行！

### 解决方案

**改用非正则匹配 `^~`（优先级 2，高于正则）**

```nginx
# ✅ 正确的 Nginx 配置顺序

server {
    # ... SSL 配置 ...

    # 1️⃣ 优先级最高：API 代理
    location /api/ {
        proxy_pass http://backend;
        ...
    }

    # 2️⃣ 优先级次高：静态资源（必须在 /admin/ 之前！）
    location ^~ /admin/assets/ {
        alias /var/www/Morning_Reading_Club/admin/dist/assets/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 3️⃣ Favicon（精确匹配）
    location = /admin/favicon.ico {
        alias /var/www/Morning_Reading_Club/admin/dist/favicon.ico;
        expires 30d;
    }

    # 4️⃣ 首页（精确匹配）
    location = /admin/ {
        root /var/www/Morning_Reading_Club/admin/dist;
        try_files /index.html =404;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # 5️⃣ SPA 路由（非正则前缀，优先级比正则高）
    location ^~ /admin/ {
        root /var/www/Morning_Reading_Club/admin/dist;
        try_files $uri /index.html =404;
    }

    # 6️⃣ 根路径
    location = / {
        return 301 /admin/;
    }
}
```

**关键改动**：
1. `location ~ ^/admin/` 改为 `location ^~ /admin/`（从正则改为非正则）
2. 把静态资源 `location ^~ /admin/assets/` 放在前面（优先匹配）
3. 按照 SPA 的需求合理组织 location 块

### 验证修复

```bash
# 验证 JavaScript 文件返回的 MIME 类型
curl -I https://wx.shubai01.com/admin/assets/index-Bmd-qS6Y.js

# 输出应该显示：
# HTTP/2 200
# content-type: application/javascript  ✅ 正确！
```

---

## 🟡 问题 3：浏览器缓存导致问题仍然存在

### 症状

即使 Nginx 服务器配置已经修复，浏览器仍然显示错误。

### 根本原因

浏览器缓存了之前的错误响应：
- 2-3 小时前的请求返回了 301 重定向 + text/html
- 浏览器把这个错误响应保存到缓存中
- 即使服务器已经修复，浏览器仍然用缓存的旧版本

### 解决方案

**服务器端**：
```bash
# 重启 Nginx 确保新配置立即生效
sudo systemctl stop nginx && sleep 2 && sudo systemctl start nginx
```

**用户端（客户必须做的）**：
```
清除浏览器缓存：
  Mac:     Cmd+Shift+Delete
  Windows: Ctrl+Shift+Delete

硬刷新页面：
  Mac:     Cmd+Shift+R
  Windows: Ctrl+Shift+R
```

**或者在开发者工具中**：
```
1. 打开浏览器开发者工具 (F12)
2. 右键点击刷新按钮（地址栏旁的圆形按钮）
3. 选择 "清空缓存并硬性重新加载"
```

---

## 💡 预防措施（以后部署必做）

### 1. Nginx 配置最佳实践

| 配置 | 说明 |
|------|------|
| ✅ 静态资源 location 放在前面 | 避免被 SPA 路由覆盖 |
| ✅ 使用 `^~` 非正则前缀（SPA） | 优先级高于正则表达式 |
| ✅ HTML 文件用 `no-cache` | 防止过期 HTML 被缓存 |
| ✅ 静态资源用 `max-age` | 充分利用浏览器缓存 |

### 2. SSL 证书选择

| 方案 | 成本 | 信任 | 自动续期 | 推荐 |
|------|------|------|--------|------|
| Let's Encrypt | 免费 | ✅ 全球浏览器 | ✅ 自动 | ✅ 首选 |
| 自签名证书 | 免费 | ❌ 仅自己 | ❌ 手动 | ❌ 仅开发 |
| 商业证书 | 付费 | ✅ 全球 | ❌ 手动 | ⚠️ 不划算 |

### 3. 部署前检查清单

```bash
# 部署前一定要做这些！

# 1. 检查 SSL 证书
openssl x509 -in /etc/letsencrypt/live/your-domain.com/fullchain.pem -text -noout | grep -E "Issuer|Subject|Valid"

# 2. 检查 Nginx 配置语法
sudo nginx -t

# 3. 测试静态资源 MIME 类型
curl -I https://your-domain.com/admin/assets/*.js   # 应该返回 application/javascript
curl -I https://your-domain.com/admin/assets/*.css  # 应该返回 text/css

# 4. 清除所有缓存并重启
sudo systemctl restart nginx
```

### 4. 线上部署流程

```bash
# 1. 申请 SSL 证书
sudo systemctl stop nginx
sudo certbot certonly --standalone -d your-domain.com --agree-tos --no-eff-email
sudo systemctl start nginx

# 2. 更新 Nginx 配置
# 编辑 /etc/nginx/sites-available/your-site.conf
# - 更改 ssl_certificate 路径
# - 调整 location 块优先级

# 3. 验证配置
sudo nginx -t

# 4. 重新加载 Nginx
sudo systemctl reload nginx
# （如果有大改动，使用 sudo systemctl restart nginx）

# 5. 测试所有路径
curl -I https://your-domain.com/
curl -I https://your-domain.com/admin/
curl -I https://your-domain.com/admin/assets/*.js
curl -I https://your-domain.com/api/v1/health
```

---

## 📁 相关文件

| 文件 | 用途 |
|------|------|
| `/etc/nginx/sites-available/morning-reading` | Nginx 配置文件 |
| `/etc/letsencrypt/live/wx.shubai01.com/` | Let's Encrypt 证书目录 |
| `/etc/cron.d/certbot` | 证书自动续期任务 |
| `admin/dist/` | 前端打包输出目录 |

---

## 🔗 相关命令

```bash
# 检查证书有效期
sudo certbot certificates

# 手动续期证书
sudo certbot renew --dry-run

# 查看自动续期日志
sudo journalctl -u certbot.service -n 50

# 检查 Nginx 进程
ps aux | grep nginx

# 实时查看 Nginx 日志
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/morning-reading-error.log
```

---

## 📝 关键总结

| 问题 | 原因 | 解决方案 |
|------|------|--------|
| SSL 证书不安全 | 自签名证书 | 申请 Let's Encrypt 免费证书 |
| 页面白屏 | Nginx location 优先级混乱 | 使用 `^~` 非正则，静态资源放前面 |
| 浏览器仍显示错误 | 浏览器缓存 | 清除缓存 + 硬刷新 |

---

**最后更新**: 2025-12-14
**验证状态**: ✅ 网站已上线，所有问题已解决
