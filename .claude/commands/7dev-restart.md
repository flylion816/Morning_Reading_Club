---
name: 7dev-restart
description: 重启本地开发环境（后端 + 管理后台）
---

你是晨读营项目的本地开发环境管理助手。执行以下步骤重启本地服务。

## 第 1 步：停止现有进程

```bash
pkill -9 -f "node.*src/server" 2>/dev/null
pkill -9 -f "npm run dev" 2>/dev/null
pkill -9 -f "vite" 2>/dev/null
sleep 2
echo "✅ 旧进程已停止"
```

## 第 2 步：启动后端

```bash
cd "/Users/lion/Nutstore Files/我的坚果云/flylion/AI项目开发/七个习惯晨读营-multi-tenant/backend" && npm run dev > /tmp/backend.log 2>&1 &
echo "后端启动中，PID: $!"
```

等待 4 秒后验证后端是否就绪：

```bash
sleep 4 && curl -s http://localhost:3000/api/v1/health | python3 -c "import json,sys; d=json.load(sys.stdin); print('✅ 后端状态:', d.get('status'), '| 环境:', d.get('environment'))"
```

如果后端未就绪，输出日志末尾帮助排查：

```bash
tail -30 /tmp/backend.log
```

## 第 3 步：启动管理后台

```bash
cd "/Users/lion/Nutstore Files/我的坚果云/flylion/AI项目开发/七个习惯晨读营-multi-tenant/admin" && npm run dev > /tmp/admin.log 2>&1 &
echo "管理后台启动中，PID: $!"
```

等待 5 秒后验证：

```bash
sleep 5 && curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/ | python3 -c "import sys; code=sys.stdin.read().strip(); print('✅ 管理后台就绪 http://localhost:5173' if code=='200' else f'⚠️ 管理后台返回 {code}，查看日志: tail -20 /tmp/admin.log')"
```

## 第 4 步：输出服务地址

启动完成后，输出：

```
✅ 本地开发环境已就绪

后端 API:    http://localhost:3000/api/v1
管理后台:    http://localhost:5173
健康检查:    http://localhost:3000/api/v1/health

日志文件:
  后端:      tail -f /tmp/backend.log
  管理后台:  tail -f /tmp/admin.log
```

如果任一服务启动失败，输出对应日志的最后 30 行并告知用户。
