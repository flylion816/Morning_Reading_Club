# 晨读营生产环境运维与重启 Runbook

**最后更新**: 2026-04-11  
**适用环境**: `wx.shubai01.com` 生产环境  
**目的**: 为线上重启、服务恢复、DNS 故障、PM2 自启动检查提供一份可直接执行的操作文档

---

## 1. 环境基线

| 项目 | 值 |
|------|----|
| 服务器 IP | `118.25.145.179` |
| 登录用户 | `ubuntu` |
| 项目根目录 | `/var/www/morning-reading` |
| 后端目录 | `/var/www/morning-reading/backend` |
| 管理后台目录 | `/var/www/morning-reading/admin/dist` |
| 线上域名 | `wx.shubai01.com` |
| PM2 应用名 | `morning-reading-backend` |
| PM2 自启动服务 | `pm2-ubuntu` |
| DNS 解析服务 | `systemd-resolved` |
| 本机健康检查 | `http://127.0.0.1:3000/api/v1/health` |
| 公网健康检查 | `https://wx.shubai01.com/api/v1/health` |
| 管理后台检查 | `https://wx.shubai01.com/admin/` |

---

## 2. 操作原则

1. 生产环境做任何重启类操作，先跑一遍 `bash scripts/verify-deployment.sh`，确认当前不是带病状态。
2. 不要把 `npx pm2` 当作唯一控制面。当前环境要求全局 `pm2` 和 `pm2-ubuntu.service` 同时存在。
3. 不要手工覆盖 `/etc/resolv.conf` 为静态文件，除非确认要放弃 `systemd-resolved`。当前机器的标准链路是：
   - `/etc/resolv.conf -> /run/systemd/resolve/stub-resolv.conf`
   - `systemd-resolved` 必须 `active + enabled`
4. 内核升级后的重启，不只看 SSH 能不能连回，要确认：
   - `boot_id` 已变化
   - `uname -r` 已切到目标内核
   - PM2、Docker、Nginx、DNS 都恢复
5. 如果线上异常只影响服务器本机出站访问，而公网入口正常，优先检查 DNS 链，而不是先怀疑 Nginx 或业务代码。

---

## 3. 标准巡检入口

### 3.1 完整部署/重启验证

```bash
ssh ubuntu@118.25.145.179
cd /var/www/morning-reading
bash scripts/verify-deployment.sh
```

这条脚本现在会检查：
- 磁盘、内存、网络
- `pm2-ubuntu` 是否 `active + enabled`
- `systemd-resolved` 是否 `active + enabled`
- `/etc/resolv.conf` 是否指向有效目标
- `getent hosts wx.shubai01.com` 是否成功
- Docker 容器、PM2、HTTP/HTTPS、SSL 证书

### 3.2 每日日志巡检

```bash
ssh ubuntu@118.25.145.179
cd /var/www/morning-reading/backend
node scripts/daily-log-report.js --test --hours 1
```

日报现在会额外输出：
- `PM2 自启动`
- `DNS 解析器`
- `resolv.conf`
- `DNS 探测`
- `基础设施告警`

如果这些基础设施项异常，会进入日报摘要并触发后续诊断。

---

## 4. 服务器重启前检查

### 4.1 执行前置检查

```bash
ssh ubuntu@118.25.145.179
cd /var/www/morning-reading
bash scripts/verify-deployment.sh
```

### 4.2 人工补充检查

```bash
uname -r
cat /proc/sys/kernel/random/boot_id
systemctl is-active pm2-ubuntu nginx docker containerd systemd-resolved
systemctl is-enabled pm2-ubuntu systemd-resolved
pm2 status --no-color
docker ps --format 'container={{.Names}} status={{.Status}}'
curl -s http://127.0.0.1:3000/api/v1/health
curl -sk https://wx.shubai01.com/api/v1/health
curl -skI https://wx.shubai01.com/admin/ | head -n 1
getent hosts wx.shubai01.com
```

### 4.3 允许重启的条件

- `pm2-ubuntu` 是 `active + enabled`
- `systemd-resolved` 是 `active + enabled`
- `getent hosts wx.shubai01.com` 成功
- `pm2 status` 里 `morning-reading-backend` 为 `4/4 online`
- MySQL、MongoDB、Redis 容器全部 `healthy`
- HTTP / HTTPS 健康检查返回 `200`

如果上面有任何一项不满足，不要直接重启，先修复。

---

## 5. 标准重启流程

### 5.1 发起重启

```bash
ssh ubuntu@118.25.145.179

cat /proc/sys/kernel/random/boot_id
uptime -s
uname -r

sudo systemctl reboot
```

### 5.2 等待机器掉线再连回

判断标准不是“SSH 很快能连”，而是：
- 先看到 SSH 断开
- 再看到 SSH 恢复
- `boot_id` 与重启前不同

建议使用以下轮询方式：

```bash
while true; do
  ssh -o BatchMode=yes -o ConnectTimeout=5 ubuntu@118.25.145.179 'cat /proc/sys/kernel/random/boot_id' && break
  sleep 2
done
```

---

## 6. 重启后检查

```bash
ssh ubuntu@118.25.145.179

cat /proc/sys/kernel/random/boot_id
uptime -s
uname -r
test -f /var/run/reboot-required && echo yes || echo no

systemctl is-active pm2-ubuntu nginx docker containerd systemd-resolved
systemctl is-enabled pm2-ubuntu systemd-resolved

pm2 status --no-color
docker ps --format 'container={{.Names}} status={{.Status}}'

ss -ltnp | grep ':3000 '

curl -s http://127.0.0.1:3000/api/v1/health
curl -sk https://wx.shubai01.com/api/v1/health
curl -skI https://wx.shubai01.com/admin/ | head -n 1

getent hosts wx.shubai01.com

cd /var/www/morning-reading
bash scripts/verify-deployment.sh
```

### 6.1 判定标准

- `uname -r` 已切到新内核
- `/var/run/reboot-required` 已消失
- `pm2-ubuntu`、`nginx`、`docker`、`containerd`、`systemd-resolved` 全部 `active`
- `morning-reading-backend` 为 `4/4 online`
- `:3000` 在监听
- 本机健康检查和公网健康检查都返回 `200`
- `/admin/` 返回 `HTTP/1.1 200 OK`
- `verify-deployment.sh` 全通过

---

## 7. 常见故障与处理

### 7.1 重启后公网正常，但服务器本机无法解析域名

典型现象：
- `curl -sk https://wx.shubai01.com/api/v1/health` 在你本地能通
- 但服务器上 `getent hosts wx.shubai01.com` 失败
- `curl: (6) Could not resolve host`

优先检查：

```bash
ls -l /etc/resolv.conf
readlink -f /etc/resolv.conf
systemctl is-active systemd-resolved
systemctl is-enabled systemd-resolved
```

当前标准修复：

```bash
sudo systemctl enable --now systemd-resolved
getent hosts wx.shubai01.com
```

根因说明：
- 这台机器使用的是 `systemd-resolved`
- `/etc/resolv.conf` 指向 `stub-resolv.conf`
- 如果 `systemd-resolved` 被禁用，重启后 stub 文件不会生成，DNS 会断

### 7.2 重启后 PM2 没有自动拉起

优先检查：

```bash
systemctl is-active pm2-ubuntu
systemctl is-enabled pm2-ubuntu
pm2 status --no-color
```

标准修复：

```bash
cd /var/www/morning-reading/backend
pm2 start pm2.config.js --env production
pm2 save
sudo env PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  pm2 startup systemd -u ubuntu --hp /home/ubuntu
sudo systemctl daemon-reload
sudo systemctl enable pm2-ubuntu
sudo systemctl start pm2-ubuntu
```

### 7.3 Docker 容器起来了，但健康检查失败

优先检查：

```bash
docker ps --format 'container={{.Names}} status={{.Status}}'
pm2 logs morning-reading-backend --lines 100
tail -n 100 /var/www/logs/morning-reading-error.log
```

常见动作：
- 如果只是应用没起来，优先恢复 PM2
- 如果是数据库容器未 `healthy`，先看对应容器日志，不要盲目反复重启应用层

### 7.4 验证脚本本身报错

当前应使用：

```bash
cd /var/www/morning-reading
bash scripts/verify-deployment.sh
```

如果脚本缺依赖库，确认以下文件存在：

```bash
ls -l /var/www/morning-reading/scripts/lib/utils.sh
ls -l /var/www/morning-reading/scripts/lib/database-functions.sh
ls -l /var/www/morning-reading/scripts/lib/deploy-functions.sh
ls -l /var/www/morning-reading/scripts/lib/infrastructure-functions.sh
```

---

## 8. 推荐操作顺序

### 8.1 仅发布代码

```bash
bash scripts/deploy-to-server.sh
ssh ubuntu@118.25.145.179 'cd /var/www/morning-reading && bash scripts/verify-deployment.sh'
```

### 8.2 仅重启后端

```bash
ssh ubuntu@118.25.145.179
pm2 reload morning-reading-backend --update-env
curl -s http://127.0.0.1:3000/api/v1/health
```

### 8.3 系统重启

```bash
# 1. 重启前验证
ssh ubuntu@118.25.145.179 'cd /var/www/morning-reading && bash scripts/verify-deployment.sh'

# 2. 执行重启
ssh ubuntu@118.25.145.179 'sudo systemctl reboot'

# 3. 等待恢复后复查
ssh ubuntu@118.25.145.179 'cd /var/www/morning-reading && bash scripts/verify-deployment.sh'
```

---

## 9. 变更记录

- `2026-04-11`:
  - 实际执行一次生产重启并完成完整复核
  - 确认 `pm2-ubuntu` 可跨重启自动恢复 4 个后端实例
  - 修复 `systemd-resolved` 未启用导致的 DNS 启动链故障
  - 将 PM2 自启动和 DNS 检查加入 `verify-deployment.sh`
  - 将 PM2 自启动和 DNS 检查加入 `daily-log-report.js`
