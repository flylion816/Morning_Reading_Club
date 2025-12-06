# 🚀 晨读营小程序完整上线计划

> **完整时间预估**：4-6周
> **最后更新**：2025-12-06
> **计划难度**：⭐⭐⭐⭐ (中等难度)

---

## 📋 上线10步完整计划

### 🔷 第1步：确定云服务提供商和域名注册商（决策阶段）

**时间**：1-2天
**关键任务**：做决策，不做实施

#### 云服务提供商选择

选择一家云厂商，推荐对比以下三家：

| 厂商 | 优势 | 成本 | 备注 |
|-----|------|------|------|
| **阿里云** | 国内最大、备案快、成熟 | ¥200-500/月 | 推荐 ✅ |
| **腾讯云** | 与微信整合好、备案快 | ¥200-500/月 | 推荐 ✅ |
| **华为云** | 价格便宜、备案快 | ¥150-400/月 | 可选 |
| **AWS** | 国际标准、功能强大 | $50-150/月 | 不推荐（需国际备案） |

**推荐方案**：选择 **阿里云** 或 **腾讯云**
- 原因：国内微信生态最优、备案最快（7-10天）、技术支持最好

#### 域名选择

- **现在就注册**：`morningreading.com` 或 `morning-reading.cn` 等
- **注册商**：阿里云域名、腾讯云域名、GoDaddy等
- **成本**：¥50-100/年
- **备案时间**：7-10天（必须，中国法律要求）

#### 决策要点

```
✅ 确定云厂商 → 我选择 ________（阿里云/腾讯云/其他）
✅ 确定域名 → 我的域名是 ________（morningreading.com）
✅ 域名注册人 → 个人/公司（需要营业执照）
✅ 备案资料 → 身份证/营业执照已准备
```

---

### 🔷 第2步：申请域名并完成备案（2-4周）

**时间**：7-10天（备案流程）+ 14天（审核）= 21-28天
**成本**：¥50-100（域名）

#### 2.1 域名注册

**在阿里云/腾讯云上：**
1. 登录云厂商官网
2. 搜索你想要的域名（如 `morningreading.cn`）
3. 加入购物车，支付¥50-100
4. 域名会立即激活（但不能使用，需要备案）

#### 2.2 ICP备案（最重要！）

**为什么必须备案**：中国法律要求，没有备案的域名无法在国内使用

**备案流程**（以阿里云为例）：

```
① 登录阿里云控制台
② 进入 ICP代备案管理
③ 选择 "新增网站"
④ 填写信息：
   - 网站信息（晨读营小程序）
   - 网站内容分类（社交/教育）
   - 服务器IP（稍后配置）
⑤ 上传资料：
   - 身份证扫描件
   - 网站负责人照片（背景幕布）
   - 营业执照（如果是公司）
⑥ 初审（1-2天）
⑦ 幕布拍照（邮寄到你家或现场拍）
⑧ 管局审核（7-10天）
⑨ 备案成功 ✅
```

#### 2.3 等待期间（可以做其他事）

在备案等待期间，你可以：
- 准备云服务器（第3步）
- 准备代码和数据库（第4步）
- 申请SSL证书（第4步）

---

### 🔷 第3步：申请云服务器和配置基础设施

**时间**：1天（购买） + 1-2天（配置）
**成本**：¥200-500/月

#### 3.1 选择服务器规格

```
推荐配置（小程序初期）：
├─ CPU: 2核
├─ 内存: 4GB RAM
├─ 带宽: 5Mbps
├─ 系统盘: 40GB
├─ 数据盘: 100GB
└─ 操作系统: Ubuntu 20.04 LTS

阿里云ECS价格：¥280-350/月
腾讯云CVM价格：¥250-320/月
```

#### 3.2 云服务器购买步骤

**在阿里云：**
```
① 进入 ECS 控制台
② 点击 "创建实例"
③ 地域选择：华东1（杭州）或华南1（深圳）
④ 实例规格：2核4GB（ecs.t6-c1m4.large）
⑤ 镜像：Ubuntu 20.04 LTS 64位
⑥ 网络：VPC 专有网络
⑦ 安全组：开放端口 80, 443, 3000
⑧ 购买时长：1个月（或3个月）
⑨ 完成支付
```

#### 3.3 配置数据库

**选择方案**（推荐）：

```
选项1：自建数据库（服务器上安装）
  ├─ 优点：便宜、灵活
  ├─ 缺点：需要自己维护、备份
  └─ 成本：仅服务器成本

选项2：云托管数据库（推荐）
  ├─ MongoDB Atlas（国际）
  ├─ 阿里云MongoDB（国内）
  ├─ 腾讯云MongoDB（国内）
  ├─ 优点：自动备份、高可用、易扩展
  └─ 成本：¥100-200/月（1GB存储）
```

**推荐**：选择 **阿里云MongoDB 云数据库**
- 与ECS在同一账号，内网速度快
- 自动备份，安全可靠
- 初期成本：¥100-150/月

#### 3.4 配置CDN（可选但推荐）

用于加速静态资源加载：
```
成本：¥50-100/月（按流量计费）
配置：阿里云 CDN + 域名绑定
```

#### 3.5 配置对象存储（用于头像、图片）

```
选择：阿里云 OSS 或 腾讯云 COS
用途：存储用户头像、图片等
成本：¥5-20/月（按存储+流量计费）
```

**第3步检查清单**：
```
✅ 服务器已购买（IP：xxx.xxx.xxx.xxx）
✅ 服务器已初始化
✅ MongoDB 数据库已创建
✅ CDN 域名已关联（可选）
✅ OSS 存储桶已创建（可选）
✅ 安全组已配置（开放80、443、3000端口）
```

---

### 🔷 第4步：申请SSL证书和配置HTTPS

**时间**：1天
**成本**：¥0（免费证书）或 ¥200-500/年（商业证书）

#### 4.1 申请免费SSL证书

**推荐方案**：使用 Let's Encrypt 免费证书

```
步骤：
① 在阿里云控制台 → SSL证书管理
② 选择 "免费证书"
③ 输入域名（morningreading.cn）
④ 验证域名所有权
   - DNS验证（推荐）：添加DNS记录
   - 文件验证：上传验证文件
⑤ 等待审核（5-10分钟）
⑥ 下载证书（PEM格式）
⑦ 上传到服务器
```

#### 4.2 在服务器配置HTTPS

```bash
# 1. 登录服务器
ssh root@你的服务器IP

# 2. 创建证书目录
sudo mkdir -p /etc/nginx/ssl

# 3. 上传证书文件（本地执行）
scp ~/证书.pem root@服务器IP:/etc/nginx/ssl/

# 4. 配置Nginx（详见第5步）
# 在 nginx.conf 中配置 SSL 证书位置
```

#### 4.3 证书自动续期

```bash
# 使用 Certbot 自动续期（推荐）
sudo apt-get install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d morningreading.cn

# 自动续期配置
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

**第4步检查清单**：
```
✅ 免费SSL证书已申请
✅ 证书已验证通过
✅ 证书已下载并上传到服务器
✅ 证书有效期确认（一般1年）
✅ 自动续期已配置
```

---

### 🔷 第5步：部署后端服务到云服务器

**时间**：2-3天
**难度**：⭐⭐⭐

#### 5.1 服务器初始化

```bash
# 登录服务器
ssh root@你的服务器IP

# 更新系统
sudo apt-get update
sudo apt-get upgrade -y

# 安装必要软件
sudo apt-get install -y git curl wget vim

# 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 PM2（进程管理）
sudo npm install -g pm2

# 安装 Nginx（反向代理）
sudo apt-get install -y nginx

# 验证安装
node --version    # v18.x.x
npm --version     # 9.x.x
pm2 --version     # 5.x.x
nginx -v          # nginx/1.x.x
```

#### 5.2 克隆项目到服务器

```bash
# 创建应用目录
sudo mkdir -p /var/www/morning-reading
cd /var/www/morning-reading

# 克隆项目
git clone https://github.com/你的用户名/Morning_Reading_Club.git .

# 进入后端目录
cd backend

# 安装依赖
npm install

# 创建生产环境配置文件
sudo cp .env.production .env
# 编辑 .env，修改：
#  - MONGODB_URI（改为阿里云MongoDB地址）
#  - API_BASE_URL（改为https://morningreading.cn）
#  - 其他敏感信息
```

#### 5.3 配置PM2启动脚本

```bash
# 编辑 pm2.config.js
sudo vi /var/www/morning-reading/backend/pm2.config.js

# 内容示例：
# module.exports = {
#   apps: [{
#     name: 'morning-reading-api',
#     script: './src/server.js',
#     instances: 2,
#     exec_mode: 'cluster',
#     env: {
#       NODE_ENV: 'production',
#       PORT: 3000
#     }
#   }]
# }

# 启动PM2
pm2 start pm2.config.js
pm2 status          # 查看状态
pm2 logs            # 查看日志
pm2 save            # 保存配置
pm2 startup         # 开机自启

# 验证API是否运行
curl http://localhost:3000/api/v1/health
```

#### 5.4 配置Nginx反向代理

```bash
# 编辑 Nginx 配置
sudo vi /etc/nginx/sites-available/default

# 替换为以下内容：
# upstream backend {
#   server localhost:3000;
#   server localhost:3001;
# }
#
# server {
#   listen 80;
#   server_name morningreading.cn;
#
#   # 重定向 HTTP 到 HTTPS
#   return 301 https://$server_name$request_uri;
# }
#
# server {
#   listen 443 ssl http2;
#   server_name morningreading.cn;
#
#   # SSL 证书配置
#   ssl_certificate /etc/nginx/ssl/证书.crt;
#   ssl_certificate_key /etc/nginx/ssl/证书.key;
#
#   # API 代理
#   location /api/ {
#     proxy_pass http://backend;
#     proxy_set_header Host $host;
#     proxy_set_header X-Real-IP $remote_addr;
#     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#     proxy_set_header X-Forwarded-Proto $scheme;
#   }
# }

# 检查配置是否正确
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx

# 验证 HTTPS
curl https://morningreading.cn/api/v1/health
```

#### 5.5 配置日志和监控

```bash
# 查看 PM2 日志
pm2 logs morning-reading-api

# 查看 Nginx 日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# 配置日志轮转
sudo vi /etc/logrotate.d/nginx
```

#### 5.6 数据库初始化

```bash
# 登录后端代码目录
cd /var/www/morning-reading/backend

# 初始化 MongoDB
npm run init:db

# 验证数据库连接
npm run verify:db
```

**第5步检查清单**：
```
✅ 服务器系统已更新
✅ Node.js 和 PM2 已安装
✅ 项目代码已克隆
✅ 依赖已安装
✅ 环境变量已配置
✅ PM2 已启动并配置开机自启
✅ Nginx 已配置反向代理
✅ SSL 证书已配置
✅ HTTPS 已生效
✅ API 接口已测试（curl 请求）
✅ 数据库已初始化
✅ 日志已配置
```

---

### 🔷 第6步：部署管理后台到云服务器

**时间**：1天
**难度**：⭐⭐

#### 6.1 构建管理后台

```bash
# 本地执行
cd admin

# 构建生产版本
npm run build

# 输出：dist 目录（包含优化后的 HTML、JS、CSS）
```

#### 6.2 上传到服务器

```bash
# 本地执行：上传构建后的文件
scp -r admin/dist root@服务器IP:/var/www/morning-reading/admin/

# 或者在服务器上直接构建
ssh root@服务器IP
cd /var/www/morning-reading/admin
npm install
npm run build
```

#### 6.3 配置Nginx提供管理后台

```bash
# 编辑 Nginx 配置，添加：
# server {
#   listen 443 ssl http2;
#   server_name admin.morningreading.cn;  # 可选：用独立子域名
#
#   ssl_certificate /etc/nginx/ssl/证书.crt;
#   ssl_certificate_key /etc/nginx/ssl/证书.key;
#
#   root /var/www/morning-reading/admin/dist;
#   index index.html;
#
#   # 支持Vue Router的SPA路由
#   location / {
#     try_files $uri $uri/ /index.html;
#   }
#
#   # 代理API请求到后端
#   location /api/ {
#     proxy_pass http://backend;
#   }
# }

# 重启 Nginx
sudo systemctl restart nginx
```

#### 6.4 验证管理后台

```bash
# 在浏览器中访问
https://morningreading.cn/admin
# 或
https://admin.morningreading.cn
```

**第6步检查清单**：
```
✅ 管理后台已构建
✅ 文件已上传到服务器
✅ Nginx 已配置提供静态文件
✅ SPA 路由已正确配置
✅ 管理后台可以访问
✅ API 代理已配置
```

---

### 🔷 第7步：小程序上线前准备（最重要！）

**时间**：3-5天
**难度**：⭐⭐⭐⭐

#### 7.1 小程序配置修改

在 `miniprogram/app.js` 中修改 API 地址：

```javascript
// 从本地开发地址改为正式地址
const API_BASE_URL = 'https://morningreading.cn/api/v1';
// 或
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://morningreading.cn/api/v1'
  : 'http://localhost:3000/api/v1';
```

#### 7.2 小程序代码审查清单

```
代码检查：
✅ 没有 console.log 调试代码
✅ 没有 debugger 语句
✅ 没有本地开发的 mock 数据
✅ 所有密钥都从环境变量读取
✅ 没有硬编码的用户ID或测试数据
✅ API 地址已改为生产地址

功能检查：
✅ 登录流程正常
✅ 打卡功能正常
✅ 数据保存正常
✅ 错误处理完善
✅ 离线容错机制完善

性能检查：
✅ 包大小 < 2MB（微信限制）
✅ 首屏加载时间 < 3秒
✅ 图片已压缩
✅ 没有内存泄漏

安全检查：
✅ 不存储敏感信息（如密码）
✅ Token 安全传输（HTTPS）
✅ 用户隐私已保护
```

#### 7.3 小程序版本更新

编辑 `miniprogram/app.json`：

```json
{
  "pages": [...],
  "version": "1.0.0",
  "build": {
    "date": "2025-12-06",
    "env": "production"
  }
}
```

#### 7.4 隐私政策和服务条款

需要准备两个文件：

**miniprogram/privacy-policy.md**（隐私政策）：
```markdown
# 晨读营小程序隐私政策

## 用户信息收集
我们收集以下信息：
1. 微信公开信息（昵称、头像）
2. 打卡数据
3. 个人资料

## 数据保护
- 数据加密存储
- 不与第三方共享
- 可随时删除账户

...
```

**miniprogram/terms-of-service.md**（服务条款）：
```markdown
# 晨读营小程序用户服务协议

## 服务内容
...

## 用户责任
...

## 免责声明
...
```

#### 7.5 准备上线资料

在微信公众平台需要上传以下资料：

```
小程序名称: 《高效能人士的七个习惯》晨读营
小程序简介: 晨读营打卡平台，帮助用户养成阅读习惯
小程序icon: 1024x1024px PNG 图片
截图: 3-5张功能演示截图
隐私政策: markdown 格式
服务条款: markdown 格式
营业执照: 如果是公司账号需要提供
```

**第7步检查清单**：
```
✅ API 地址已改为生产地址
✅ 所有 console.log 已删除
✅ 所有硬编码数据已移除
✅ 代码已测试无错误
✅ 隐私政策已准备
✅ 服务条款已准备
✅ 小程序icon已准备
✅ 功能演示截图已准备
```

---

### 🔷 第8步：在微信公众平台注册小程序并配置

**时间**：2-3天
**难度**：⭐⭐

#### 8.1 注册微信小程序账号

进入 [微信公众平台](https://mp.weixin.qq.com/)

```
① 点击 "立即注册"
② 选择账号类型："小程序"
③ 填写邮箱和密码
④ 邮箱激活
⑤ 选择主体："个人" 或 "企业"
⑥ 实名认证（个人需要身份证，企业需要营业执照）
⑦ 获取 AppID 和 AppSecret
```

#### 8.2 完善小程序信息

在 [微信公众平台](https://mp.weixin.qq.com/) → 设置 → 基本设置：

```
基本信息：
- 小程序名称: 《高效能人士的七个习惯》晨读营
- 小程序icon: 上传 1024x1024px 图片
- 小程序简介: 晨读营打卡平台
- 服务类目: 教育 - 在线教育

服务器配置：
- 请求域名：https://morningreading.cn
- WebSocket 域名：wss://morningreading.cn
- 上传图片域名：https://morningreading.cn
- 下载图片域名：https://morningreading.cn
```

#### 8.3 获取AppID和AppSecret

```
AppID: wx1234567890abcdef  （记录这个！）
AppSecret: 1234567890abcdef1234567890abcdef  （保密！）
```

#### 8.4 在后端配置AppID

编辑 `backend/.env.production`：

```
WECHAT_APPID=wx1234567890abcdef
WECHAT_SECRET=1234567890abcdef1234567890abcdef
```

重启后端服务：

```bash
pm2 restart morning-reading-api
```

#### 8.5 配置业务域名

在微信公众平台 → 设置 → 业务域名：

添加你的域名：`https://morningreading.cn`

（需要下载验证文件，上传到 `https://morningreading.cn/MP_verify_xxxxx.txt`）

```bash
# 在服务器上创建验证文件
echo "xxxxx" | sudo tee /var/www/morning-reading/backend/public/MP_verify_xxxxx.txt

# 访问验证
curl https://morningreading.cn/MP_verify_xxxxx.txt
```

**第8步检查清单**：
```
✅ 微信小程序账号已注册
✅ 实名认证已完成
✅ AppID 和 AppSecret 已获取
✅ 小程序基本信息已完善
✅ 业务域名已配置
✅ 服务器配置已提交
✅ 后端已配置 AppID 和 AppSecret
```

---

### 🔷 第9步：提交小程序审核并获取正式版本

**时间**：3-5天（审核时间）
**难度**：⭐⭐

#### 9.1 上传小程序代码到微信后台

使用 **微信开发者工具**：

```
① 打开微信开发者工具
② 登录账号（用注册小程序的微信号）
③ 打开 miniprogram 项目目录
④ 点击 "上传" 按钮
⑤ 填写版本号：1.0.0
⑥ 填写项目备注：首次上线版本
⑦ 点击 "上传"
```

#### 9.2 在微信公众平台提交审核

登录 [微信公众平台](https://mp.weixin.qq.com/)

进入 版本管理 → 开发版本：

```
① 找到刚才上传的版本
② 点击 "提交审核"
③ 填写审核信息：
   - 功能描述：晨读营打卡平台
   - 测试账号：(可选)
   - 备注：首次上线申请
④ 点击 "确认提交"
```

#### 9.3 等待微信审核（3-5天）

微信会对小程序进行审核，检查：

```
✓ 隐私政策是否完善
✓ 功能是否符合类目
✓ 是否有违规内容
✓ 是否侵犯版权
✓ 是否有欺骗用户行为
```

#### 9.4 审核通过后发布

审核通过后，在微信公众平台：

```
① 进入 版本管理 → 审核版本
② 点击 "发布" 按钮
③ 确认发布
④ 小程序正式上线！ 🎉
```

**如果审核被拒：**

```
① 查看拒审原因
② 修改代码或资料
③ 重新上传并提交审核
（一般最多需要改2-3次就能通过）
```

**第9步检查清单**：
```
✅ 代码已上传到微信后台
✅ 审核信息已填写完整
✅ 已提交审核
✅ 等待审核结果（3-5天）
✅ 审核通过后已发布
✅ 小程序已在微信应用市场上线
```

---

### 🔷 第10步：监控和运维系统配置

**时间**：1-2天
**难度**：⭐⭐⭐

#### 10.1 配置日志监控

```bash
# 查看服务器日志
pm2 logs morning-reading-api | tail -100

# 查看错误日志
tail -f /var/log/nginx/error.log

# 导出日志到文件（保存备份）
pm2 logs morning-reading-api > /var/log/app.log
```

#### 10.2 配置自动备份

```bash
# 创建备份脚本
sudo vi /usr/local/bin/backup-mongodb.sh

#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --uri="mongodb://admin:password@host:27017/morning_reading" \
  --out=/backups/mongo_$DATE

# 设置定时备份（每天凌晨2点）
sudo crontab -e
# 添加：0 2 * * * /usr/local/bin/backup-mongodb.sh

# 启用定时任务
sudo systemctl enable cron
```

#### 10.3 配置监控告警

**推荐方案：使用阿里云监控**

```
① 登录阿里云控制台
② 进入 云监控
③ 创建告警规则：
   - CPU使用率 > 80% 则告警
   - 内存使用率 > 80% 则告警
   - 磁盘使用率 > 90% 则告警
④ 配置告警通知：短信/邮件/钉钉
```

#### 10.4 配置应用性能监控（APM）

```bash
# 安装 New Relic（可选但推荐）
cd backend
npm install newrelic --save

# 编辑 pm2.config.js，添加：
# {
#   name: 'morning-reading-api',
#   script: 'newrelic.js',
#   ...
# }
```

#### 10.5 设置故障恢复计划

创建文件：`.claude/memory/disaster-recovery-plan.md`

```markdown
# 故障恢复计划

## 服务崩溃恢复
1. PM2 会自动重启应用
2. 如果仍失败，执行：pm2 restart morning-reading-api
3. 检查日志：pm2 logs

## 数据库故障恢复
1. 检查MongoDB状态
2. 使用备份恢复：mongorestore --uri="..." /backups/

## 域名故障
1. 检查DNS配置
2. 联系域名注册商

## 完整宕机恢复（如服务器崩溃）
1. 启动新服务器
2. 恢复代码：git clone
3. 恢复数据：mongorestore
4. 启动服务：pm2 start
```

#### 10.6 性能优化

```
监控指标：
- API 平均响应时间 < 200ms
- 服务器CPU使用率 < 60%
- 内存使用率 < 70%
- 数据库查询耗时 < 100ms

优化方案：
- 添加 Redis 缓存
- 优化数据库查询
- 启用 Gzip 压缩
- 使用 CDN 加速
```

**第10步检查清单**：
```
✅ 日志监控已配置
✅ 自动备份已启用
✅ 告警规则已设置
✅ APM 已配置（可选）
✅ 故障恢复计划已制定
✅ 性能监控已启动
✅ 定期检查日志和指标
```

---

## 📊 完整时间表

| 步骤 | 任务 | 时间 | 成本 |
|-----|------|------|------|
| 1 | 确定云厂商和域名 | 1-2天 | ¥0 |
| 2 | 申请域名和备案 | 21-28天 | ¥50-100 |
| 3 | 购买服务器和数据库 | 1-2天 | ¥300-700/月 |
| 4 | 申请SSL证书 | 1天 | ¥0-500/年 |
| 5 | 部署后端服务 | 2-3天 | 包含在3中 |
| 6 | 部署管理后台 | 1天 | 包含在3中 |
| 7 | 小程序上线前准备 | 3-5天 | ¥0 |
| 8 | 注册小程序账号 | 2-3天 | ¥0-300 |
| 9 | 提交审核和上线 | 3-5天 | ¥0 |
| 10 | 监控和运维 | 1-2天 | 包含在3中 |
| **总计** | | **4-6周** | **¥350-1300** |

---

## 💰 成本估算

### 初期成本（首月）

```
域名注册          ¥50-100
云服务器(ECS)     ¥280-350
MongoDB数据库     ¥100-150
CDN加速(可选)     ¥50-100
OSS存储(可选)     ¥5-20
SSL证书(免费)     ¥0
小程序认证(个人)  ¥0
小程序认证(企业)  ¥300

小计（个人）      ¥485-720
小计（企业）      ¥785-1020
```

### 月度运营成本

```
云服务器          ¥280-350
MongoDB数据库     ¥100-150
CDN加速(可选)     ¥50-100
OSS存储(可选)     ¥5-20
流量和其他        ¥50-100

小计              ¥485-720/月
```

---

## 🎯 关键决策点

在上线前，你需要做出以下决策：

```
1. 云厂商选择：阿里云 / 腾讯云 / 其他
   → 推荐：阿里云（备案最快）

2. 数据库方案：自建 / 云托管
   → 推荐：云托管（省心）

3. 存储方案：自建 / OSS / COS
   → 推荐：OSS（集成度高）

4. 域名备案：个人 / 企业
   → 个人：3-5个工作日
   → 企业：7-10个工作日

5. CDN加速：是否启用
   → 推荐：启用（提升用户体验）

6. 小程序主体：个人 / 企业
   → 个人：免费，功能有限制
   → 企业：¥300，功能完整
```

---

## ⚠️ 重要提醒

### 必须做

- ✅ 域名备案（中国法律要求，不能跳过）
- ✅ 隐私政策和服务条款（微信审核要求）
- ✅ HTTPS配置（微信要求）
- ✅ 数据库备份策略
- ✅ 安全性检查（没有硬编码密钥）

### 千万不能做

- ❌ 在代码中硬编码敏感信息
- ❌ 未备案就使用域名
- ❌ 没有HTTPS就提交审核
- ❌ 没有隐私政策直接上线
- ❌ 在生产环境使用 console.log
- ❌ 没有备份就上线

---

## 📞 常见问题解答

**Q1：如果备案被拒怎么办？**
```
A：联系云厂商，查看拒审原因。常见原因：
   - 网站名称不符：修改后重新申请
   - 资料不清晰：重新上传高清证件
   - 备案号与网站内容不符：修改网站内容或备案信息
   - 通常改一次就能通过
```

**Q2：小程序审核被拒怎么办？**
```
A：查看拒审原因，常见原因：
   - 隐私政策不完善：补充详细隐私政策
   - 功能与描述不符：修改功能或描述
   - 有违规内容：删除违规内容
   - 通常改1-2次就能通过
```

**Q3：万一生产环境崩溃怎么办？**
```
A：按照故障恢复计划执行：
   1. PM2 自动重启（大多数情况）
   2. 如果不行，手动重启：pm2 restart all
   3. 如果服务器崩溃，启动新服务器恢复数据
```

**Q4：需要什么编程经验？**
```
A：需要以下基础知识：
   - Linux / Shell 命令
   - Node.js / npm 使用
   - Nginx 配置基础
   - MongoDB 基础操作
   - Git / GitHub 使用

   本计划中所有命令都是标准操作，
   复制粘贴执行即可，不需要深入了解
```

---

## ✅ 上线完成标志

当你完成以下所有项目时，说明上线成功：

```
☑ 域名已备案，可正常访问
☑ HTTPS 已生效（浏览器显示🔒）
☑ 后端API接口正常响应
☑ 管理后台可以登录使用
☑ 小程序已在微信上线
☑ 用户可以通过微信扫一扫打开小程序
☑ 打卡功能正常
☑ 数据正确保存到数据库
☑ 日志监控已启用
☑ 备份系统已运行
☑ 你可以随时查看用户数据和日志
```

---

## 🚀 后续优化

上线后，可以逐步优化：

```
第一周：
- 收集用户反馈
- 修复bug
- 优化性能

第二周：
- 添加更多功能（如排行榜优化）
- 优化UI/UX
- 增加社交功能

第三周+：
- 数据分析和运营
- 用户增长计划
- 品牌宣传
```

---

**最后更新**：2025-12-06
**文档版本**：1.0
**联系方式**：通过 GitHub Issues 提问
**相关文档**：`DEPLOYMENT.md`、`SECURITY.md`、`GIT_WORKFLOW.md`
