# Nginx Authorization 请求头转发修复指南

## 问题诊断

**现象**：管理后台所有 API 请求返回 `401 Unauthorized`，即使前端已经发送了正确的 Authorization 请求头

**根本原因**：Nginx 反向代理默认不转发某些请求头（包括 Authorization），导致后端 `req.headers.authorization` 始终为 undefined

## 解决方案

### 步骤1：SSH 连接到线上服务器

```bash
ssh root@wx.shubai01.com
# 或使用 IP: ssh root@47.241.x.x
```

### 步骤2：编辑 Nginx 配置文件

```bash
sudo nano /etc/nginx/sites-available/wx.shubai01.com
# 或使用 vim: sudo vim /etc/nginx/sites-available/wx.shubai01.com
```

### 步骤3：在 API proxy 块中添加以下配置

找到以下这一部分（大约在文件的前面）：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3000;  # 或 http://backend;
    # ... 其他配置 ...
}
```

修改为（添加 Authorization 请求头转发）：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3000;

    # ⭐ 关键：转发所有请求头，特别是 Authorization
    proxy_pass_request_headers on;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $server_name;
    proxy_set_header X-Forwarded-Port $server_port;

    # 其他代理设置
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
```

### 步骤4：验证 Nginx 配置语法

```bash
sudo nginx -t
```

预期输出：
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration will be successful
```

### 步骤5：重新加载 Nginx

```bash
# 优雅重新加载（不中断现有连接）
sudo systemctl reload nginx

# 或者重启（完全重启，会中断连接，但通常更彻底）
sudo systemctl restart nginx
```

### 步骤6：验证修复成功

```bash
# 获取一个有效的 token（通过登录）
# 然后测试 API：

curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  https://wx.shubai01.com/api/v1/audit-logs/statistics

# 应该返回 200，而不是 401
```

## 完整的 Nginx 配置参考

如果您的 Nginx 配置文件需要完整重写，这是推荐的配置（基于线上现状）：

```nginx
upstream backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name wx.shubai01.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name wx.shubai01.com;

    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/wx.shubai01.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wx.shubai01.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 1. API 代理 - 必须在其他 location 之前！
    location /api/ {
        proxy_pass http://backend;

        # ⭐ 最关键的两行：转发请求头
        proxy_pass_request_headers on;
        proxy_set_header Authorization $http_authorization;

        # 其他必要的请求头
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_set_header Host $host;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # CORS 相关（后端通常会处理，但如需Nginx层处理）
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
    }

    # 2. 管理后台静态资源（必须在 /admin/ 路由之前）
    location ^~ /admin/assets/ {
        alias /var/www/morning-reading/admin/dist/assets/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 3. 管理后台 Favicon
    location = /admin/favicon.ico {
        alias /var/www/morning-reading/admin/dist/favicon.ico;
        expires 30d;
    }

    # 4. 管理后台 SPA 路由（使用 ^~ 非正则前缀）
    location ^~ /admin/ {
        root /var/www/morning-reading/admin/dist;
        try_files $uri /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # 5. 根路径重定向到管理后台
    location = / {
        return 301 /admin/;
    }

    # 6. 健康检查
    location /health {
        return 200 "ok";
        add_header Content-Type text/plain;
    }
}
```

## 故障排查

### 问题：重载后仍然返回 401

**可能原因**：

1. **Nginx 缓存**：旧配置仍在内存中
   - 解决：使用 `systemctl restart nginx` 而不是 `reload`

2. **浏览器缓存**：旧的失败响应被缓存
   - 解决：按 `Ctrl+Shift+Delete` 清除浏览器缓存，然后硬刷新 (`Ctrl+Shift+R`)

3. **配置未保存**：编辑后忘记保存文件
   - 解决：在 nano 中使用 `Ctrl+X` → `Y` → `Enter` 确认保存
   - 在 vim 中使用 `:wq` 确认保存

4. **使用了错误的域名或路径**
   - 验证命令：
   ```bash
   curl -v https://wx.shubai01.com/api/v1/health
   ```
   - 检查响应头中是否看到 Authorization 请求头被转发

### 问题：转发了 Authorization 后，后端仍然收不到

**检查后端日志**：

```bash
# 在后端服务器查看日志
tail -f /var/www/morning-reading/backend/logs/app.log

# 查找 [API Request] 相关日志，检查是否收到 Authorization header
grep "API Request" /var/www/morning-reading/backend/logs/app.log | tail -20
```

如果后端日志显示没有收到 Authorization header，说明 Nginx 配置仍未生效。

## 常见配置错误

| 错误                          | 正确做法                                   |
|-------------------------------|-------------------------------------------|
| ❌ `proxy_set_header Authorization $http_authorization;` 放在了错误的 location 块 | ✅ 确保在 `/api/` location 块中 |
| ❌ 只配置了 `proxy_pass_request_headers` 但没有 `proxy_set_header` | ✅ 两行都需要，特别是 Authorization |
| ❌ 使用了 `$http_authorization` 但前面没有 `proxy_pass_request_headers on;` | ✅ 必须先启用请求头转发 |
| ❌ 修改后没有 reload 或 restart Nginx | ✅ 执行 `sudo systemctl reload nginx` |

## 验证清单

修改完 Nginx 后，按照这个清单验证：

- [ ] 使用 `sudo nginx -t` 验证配置语法正确
- [ ] 使用 `sudo systemctl reload nginx` 重新加载（或 restart）
- [ ] 清除浏览器缓存并硬刷新（`Ctrl+Shift+R`）
- [ ] 重新登录管理后台
- [ ] 打开审计日志页面，查看是否有 401 错误
- [ ] 在浏览器控制台查看网络请求，确认 API 返回 200（或其他成功状态码）

## 相关文件位置

| 文件 | 位置 |
|------|------|
| Nginx 配置 | `/etc/nginx/sites-available/wx.shubai01.com` |
| Nginx 错误日志 | `/var/log/nginx/error.log` 或 `/var/log/nginx/morning-reading-error.log` |
| 后端日志 | `/var/www/morning-reading/backend/logs/app.log` |
| 后端服务 | PM2: `pm2 list` 查看状态 |

