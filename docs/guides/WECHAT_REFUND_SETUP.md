# 微信支付退款功能配置指南

## 前提：下载商户证书

1. 登录微信商户平台：https://pay.weixin.qq.com
2. 进入「账户中心」→「API安全」→「API证书」→「申请证书」
3. 下载后解压，得到：
   - `apiclient_cert.pem`（证书文件）
   - `apiclient_key.pem`（私钥文件）
   - `apiclient_cert.p12`（退款只需前两个，这个备用）

## 上传证书到服务器

```bash
# 在服务器上创建证书目录
ssh -i ~/.ssh/id_ed25519 ubuntu@118.25.145.179 "mkdir -p /var/www/certs && chmod 700 /var/www/certs"

# 上传证书文件（在本机执行）
scp -i ~/.ssh/id_ed25519 apiclient_cert.pem ubuntu@118.25.145.179:/var/www/certs/
scp -i ~/.ssh/id_ed25519 apiclient_key.pem ubuntu@118.25.145.179:/var/www/certs/

# 设置权限
ssh -i ~/.ssh/id_ed25519 ubuntu@118.25.145.179 "chmod 600 /var/www/certs/*.pem"
```

## 配置环境变量

在服务器 `/var/www/morning-reading/.env` 中添加：

```
WECHAT_CERT_PATH=/var/www/certs/apiclient_cert.pem
WECHAT_KEY_PATH=/var/www/certs/apiclient_key.pem
```

## 完成后告知开发

证书配置好后，告知开发即可实现：
- 取消报名自动全额退款
- 退款状态同步到 payment 记录
- 管理后台可查看退款记录
