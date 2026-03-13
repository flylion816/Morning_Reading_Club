# 🔐 SSL 证书管理

## 证书信息

### 晨读营线上域名

**域名**：`wx.shubai01.com`

**证书提供商**：Let's Encrypt（免费）

**证书路径**（生产服务器）：
```
/etc/letsencrypt/live/wx.shubai01.com/
```

**证书文件**：
- `privkey.pem` - 私钥（绝对保密！）
- `cert.pem` - 证书（公开）
- `chain.pem` - 证书链
- `fullchain.pem` - 完整证书链

---

## 证书有效期

使用命令查看：
```bash
sudo certbot certificates
```

**输出示例**：
```
Found the following certs:
  Certificate Name: wx.shubai01.com
    Domains: wx.shubai01.com
    Expiry Date: 2026-06-01 (about 80 days left)
    Certificate Path: /etc/letsencrypt/live/wx.shubai01.com/fullchain.pem
    Private Key Path: /etc/letsencrypt/live/wx.shubai01.com/privkey.pem
```

---

## 自动续期配置

### Certbot 定时任务

```bash
# 查看 Certbot 定时任务状态
sudo systemctl status certbot.timer

# 查看定时任务日志
sudo journalctl -u certbot.timer
```

### 手动续期

```bash
# 干运行（测试，不实际续期）
sudo certbot renew --dry-run

# 实际续期
sudo certbot renew

# 强制续期
sudo certbot renew --force-renewal
```

### 续期后重新加载 Nginx

```bash
sudo systemctl reload nginx
```

---

## 证书备份

### 为什么备份证书？

虽然证书可以通过 Let's Encrypt 重新申请，但备份有以下好处：
- 紧急恢复时无需等待新证书申请
- 保留旧证书的历史记录
- 防止服务中断

### 备份步骤

```bash
# 1. 打包证书
sudo tar -czf /tmp/letsencrypt-backup-$(date +%Y%m%d).tar.gz /etc/letsencrypt/

# 2. 下载到本地
scp -i ~/.ssh/id_rsa ubuntu@118.25.145.179:/tmp/letsencrypt-backup-*.tar.gz \
  ./letsencrypt-backup/

# 3. 长期保存（云存储或私密仓库）
```

---

## 证书续期失败排查

### 常见原因

1. **端口 80 被占用**
   ```bash
   sudo lsof -i :80
   # Kill 占用端口的进程
   ```

2. **DNS 解析失败**
   ```bash
   nslookup wx.shubai01.com
   ```

3. **域名指向错误**
   ```bash
   # 查看 A 记录
   dig wx.shubai01.com
   ```

4. **Certbot 权限问题**
   ```bash
   sudo certbot renew -v
   ```

---

## 重要提示

⚠️ **私钥安全**：
- 从不分享私钥文件
- 不要将 `/etc/letsencrypt/` 上传到 git
- 备份时使用加密存储

✅ **续期检查**：
- Let's Encrypt 会在过期前 30 天发送邮件
- Certbot 自动续期机制应该处理大部分情况
- 定期监控证书状态

---

**最后更新**：2026-03-13
