# 七个习惯晨读营 - 本地开发环境搭建指南

## 📋 目录
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [详细步骤](#详细步骤)
- [API测试](#api测试)
- [常见问题](#常见问题)

## 🔧 环境要求

- Node.js >= 18.0.0
- Docker Desktop
- 微信开发者工具
- Git

## 🚀 快速开始

### 1. 启动数据库服务

```bash
cd backend
docker-compose up -d
```

这将启动以下服务：
- **MongoDB** (端口 27017)
- **MySQL** (端口 3306)
- **Redis** (端口 6379)

### 2. 初始化数据库

```bash
# 安装依赖
npm install

# 初始化 MongoDB（包含测试数据）
npm run init:mongodb
```

### 3. 启动后端服务

```bash
# 开发模式（带热重载）
npm run dev

# 或生产模式
npm start
```

后端服务将在 `http://localhost:3000` 启动

### 4. 配置小程序

小程序已自动配置为连接本地后端：
- API 地址：`http://localhost:3000/api/v1`
- Mock 模式：已关闭

### 5. 运行小程序

1. 打开**微信开发者工具**
2. 导入项目，选择 `miniprogram` 目录
3. 在设置中勾选：
   - ✅ 不校验合法域名
   - ✅ 开启调试模式
4. 编译运行

## 📖 详细步骤

### 数据库配置

#### MongoDB
- 主机：`localhost:27017`
- 数据库：`morning_reading`
- 用户：`admin`
- 密码：`admin123`

#### MySQL
- 主机：`localhost:3306`
- 数据库：`morning_reading`
- 用户：`morning_user`
- 密码：`morning123`

#### Redis
- 主机：`localhost:6379`
- 密码：无

### 环境变量

所有环境变量配置在 `backend/.env` 文件中：

```env
# Server
NODE_ENV=development
PORT=3000

# MongoDB
MONGODB_URI=mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin

# MySQL
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=morning_reading
MYSQL_USER=morning_user
MYSQL_PASSWORD=morning123

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-jwt-key-change-this-in-production
JWT_EXPIRES_IN=2h
JWT_REFRESH_EXPIRES_IN=30d

# WeChat Mini Program (Mock)
WECHAT_APP_ID=wx199d6d332344ed0a
WECHAT_APP_SECRET=mock_secret_for_local_development
```

### 初始化数据说明

运行 `npm run init:mongodb` 后会创建以下测试数据：

#### 👥 用户 (5个)
- 管理员
- 阿泰（已打卡3天）
- 李四
- 王五
- 赵六

#### 📚 期次 (3个)
- 勇敢的心（进行中）
- 能量之泉（已完成）
- 心流之境（已完成）

#### 📖 课节 (5个)
- 开营词（第0天）
- 第一天：品德成功论
- 第二天：思维方式的力量
- 第三天：以原则为中心的思维方式
- 第四天：成长和改变的原则

#### ✅ 打卡记录 (3个)
- 用户"阿泰"的前3天打卡

#### 💬 评论 (3个)
- 针对打卡记录的社区互动

#### 🤖 AI反馈 (1个)
- 第1天的AI学习反馈

## 🧪 API测试

### 1. 健康检查
```bash
curl http://localhost:3000/health
```

### 2. 微信登录（Mock）
```bash
curl -X POST http://localhost:3000/api/v1/auth/wechat/login \
  -H "Content-Type: application/json" \
  -d '{"code":"test_code_123"}'
```

返回示例：
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresIn": 7200,
    "user": {
      "id": "...",
      "nickname": "微信用户",
      "avatar": "🦁",
      "role": "user"
    }
  }
}
```

### 3. 获取期次列表
```bash
# 先登录获取token
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/wechat/login \
  -H "Content-Type: application/json" \
  -d '{"code":"test"}' | jq -r '.data.accessToken')

# 使用token获取期次列表
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/periods
```

### 4. 获取课节列表
```bash
# 获取第一个期次的ID
PERIOD_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/periods | jq -r '.data.list[0]._id')

# 获取该期次的课节列表
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/sections/period/$PERIOD_ID"
```

### 5. 创建打卡
```bash
SECTION_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/sections/period/$PERIOD_ID" | jq -r '.data.list[0]._id')

curl -X POST http://localhost:3000/api/v1/checkins \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"periodId\": \"$PERIOD_ID\",
    \"sectionId\": \"$SECTION_ID\",
    \"day\": 1,
    \"readingTime\": 15,
    \"completionRate\": 100,
    \"note\": \"今天学到了很多！\",
    \"mood\": \"inspired\"
  }"
```

## 🌐 核心API端点

### 认证相关
- `POST /api/v1/auth/wechat/login` - 微信登录
- `POST /api/v1/auth/refresh` - 刷新Token

### 用户相关
- `GET /api/v1/users/me` - 获取当前用户信息
- `PUT /api/v1/users/profile` - 更新用户资料
- `GET /api/v1/users/:userId/stats` - 获取用户统计

### 期次相关
- `GET /api/v1/periods` - 获取期次列表
- `GET /api/v1/periods/:periodId` - 获取期次详情
- `POST /api/v1/periods` - 创建期次（管理员）
- `PUT /api/v1/periods/:periodId` - 更新期次（管理员）
- `DELETE /api/v1/periods/:periodId` - 删除期次（管理员）

### 课节相关
- `GET /api/v1/sections/period/:periodId` - 获取期次的课节列表
- `GET /api/v1/sections/:sectionId` - 获取课节详情
- `POST /api/v1/sections` - 创建课节（管理员）
- `PUT /api/v1/sections/:sectionId` - 更新课节（管理员）
- `DELETE /api/v1/sections/:sectionId` - 删除课节（管理员）

### 打卡相关
- `POST /api/v1/checkins` - 创建打卡记录
- `GET /api/v1/checkins/user/:userId?` - 获取用户的打卡列表
- `GET /api/v1/checkins/period/:periodId` - 获取期次的打卡列表（广场）
- `GET /api/v1/checkins/:checkinId` - 获取打卡详情
- `DELETE /api/v1/checkins/:checkinId` - 删除打卡记录

### 评论相关
- `POST /api/v1/comments` - 创建评论
- `GET /api/v1/comments/checkin/:checkinId` - 获取打卡的评论列表
- `POST /api/v1/comments/:commentId/replies` - 回复评论
- `DELETE /api/v1/comments/:commentId` - 删除评论
- `DELETE /api/v1/comments/:commentId/replies/:replyId` - 删除回复

### AI反馈相关
- `POST /api/v1/insights/generate` - 生成AI反馈
- `GET /api/v1/insights/user/:userId?` - 获取用户的反馈列表
- `GET /api/v1/insights/:insightId` - 获取反馈详情
- `DELETE /api/v1/insights/:insightId` - 删除反馈

## 🐛 常见问题

### 1. Docker启动失败

**问题**：Docker Desktop没有运行

**解决**：
```bash
# 打开Docker Desktop
open -a "Docker"

# 等待Docker完全启动后再执行docker-compose
sleep 30
docker-compose up -d
```

### 2. MongoDB连接失败

**问题**：容器启动了但连接不上

**解决**：
```bash
# 检查容器状态
docker-compose ps

# 查看容器日志
docker-compose logs mongodb

# 重启容器
docker-compose restart mongodb
```

### 3. 端口被占用

**问题**：`Error: listen EADDRINUSE: address already in use :::3000`

**解决**：
```bash
# 查找占用端口的进程
lsof -i :3000

# 杀掉进程
kill -9 <PID>

# 或者修改 backend/.env 中的 PORT
PORT=3001
```

### 4. 小程序无法连接本地服务

**问题**：请求失败或超时

**解决**：
1. 检查后端服务是否运行：`curl http://localhost:3000/health`
2. 微信开发者工具设置：
   - ✅ 不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书
   - ✅ 开启调试模式
3. 确认 `miniprogram/config/env.js` 中的 `apiBaseUrl` 是 `http://localhost:3000/api/v1`
4. 确认 `useMock` 设置为 `false`

### 5. 初始化数据失败

**问题**：`npm run init:mongodb` 报错

**解决**：
```bash
# 确认MongoDB容器正在运行
docker-compose ps

# 查看详细错误
npm run init:mongodb 2>&1 | tee init.log

# 清空数据库重新初始化
docker-compose down -v
docker-compose up -d
sleep 10
npm run init:mongodb
```

## 🛠 开发工具

### 推荐VS Code插件
- MongoDB for VS Code
- REST Client
- Docker
- ESLint
- Prettier

### 数据库管理工具
- **MongoDB**: MongoDB Compass
- **MySQL**: MySQL Workbench 或 TablePlus
- **Redis**: RedisInsight

## 📝 开发流程

### 1. 修改模型
编辑 `backend/src/models/*.js`

### 2. 修改控制器
编辑 `backend/src/controllers/*.controller.js`

### 3. 修改路由
编辑 `backend/src/routes/*.routes.js`

### 4. 测试API
使用 curl 或 Postman 测试

### 5. 更新小程序
修改小程序代码，编译运行

## 🔄 重新初始化

如果需要重新开始：

```bash
# 停止所有服务
docker-compose down -v

# 重新启动数据库
docker-compose up -d

# 等待数据库启动完成
sleep 10

# 重新初始化数据
npm run init:mongodb

# 启动后端服务
npm run dev
```

## 📊 项目结构

```
七个习惯晨读营/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── config/         # 配置文件
│   │   ├── controllers/    # 控制器
│   │   ├── middleware/     # 中间件
│   │   ├── models/         # 数据模型
│   │   ├── routes/         # 路由
│   │   ├── services/       # 业务逻辑
│   │   ├── utils/          # 工具函数
│   │   ├── app.js          # Express应用
│   │   └── server.js       # 服务器入口
│   ├── scripts/            # 脚本
│   │   └── init-mongodb.js # MongoDB初始化
│   ├── docker-compose.yml  # Docker配置
│   ├── package.json        # 依赖管理
│   └── .env                # 环境变量
├── miniprogram/            # 小程序
│   ├── config/             # 配置文件
│   ├── pages/              # 页面
│   ├── components/         # 组件
│   └── utils/              # 工具函数
└── LOCAL_SETUP_GUIDE.md    # 本指南
```

## 🎉 完成！

现在你已经成功搭建了本地开发环境！

- ✅ 数据库服务运行在 Docker 中
- ✅ 后端API服务运行在 http://localhost:3000
- ✅ 小程序已配置连接本地后端
- ✅ 测试数据已初始化完成

开始愉快的开发吧！🚀
