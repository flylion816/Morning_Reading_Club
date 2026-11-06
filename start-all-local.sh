#!/bin/bash
################################################################################
# 晨读营 - 本地开发环境一键启动
#
# 用法：
#   bash start-all-local.sh              启动 MongoDB/Redis（如未运行）+ 后端 + 管理后台
#   bash start-all-local.sh --mini-dev   同时把小程序切到本地后端（env.js → 'dev'）
#   bash start-all-local.sh --no-admin   只启动后端
#   ADMIN_PORT=5180 bash start-all-local.sh   指定管理后台端口（默认 5174，被占用时自动顺延）
#
# 停止：bash stop-all-local.sh
#
# 安全约定：
#   - 只启停本项目自己启动的进程（记录在 .local-run/），不会杀掉其他项目的 node / vite
#   - 绝不初始化或清空数据库；数据库为空时只提示
################################################################################

set -u

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
ADMIN_DIR="$PROJECT_DIR/admin"
ENV_JS="$PROJECT_DIR/miniprogram/config/env.js"
RUN_DIR="$PROJECT_DIR/.local-run"
LOG_DIR="$PROJECT_DIR/logs/local"
BACKEND_PORT=3000
ADMIN_PORT="${ADMIN_PORT:-5174}"

MINI_DEV=false
START_ADMIN=true
for arg in "$@"; do
  case "$arg" in
    --mini-dev) MINI_DEV=true ;;
    --no-admin) START_ADMIN=false ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    *) echo "未知参数: $arg（用 --help 查看用法）"; exit 1 ;;
  esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✓${NC} $*"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $*"; }
fail() { echo -e "  ${RED}✗${NC} $*"; exit 1; }
step() { echo -e "\n${BLUE}▶ $*${NC}"; }

mkdir -p "$RUN_DIR" "$LOG_DIR"

# 进程的工作目录是否在本项目内（用来判断"是不是我们自己启动的"）
is_ours() {
  local pid="$1"
  local cwd
  # lsof 会把中文路径转义成 \xHH，用 printf %b 还原后再比较
  cwd=$(printf '%b' "$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')")
  [[ "$cwd" == "$PROJECT_DIR"* ]]
}
port_pid() { lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null | head -1; }
port_open() { nc -z 127.0.0.1 "$1" >/dev/null 2>&1; }

stop_pidfile() {
  local name="${2:-$1}" file="$RUN_DIR/$1.pid"
  [ -f "$file" ] || return 0
  local pid; pid=$(cat "$file")
  if kill -0 "$pid" 2>/dev/null && is_ours "$pid"; then
    kill "$pid" 2>/dev/null
    for _ in 1 2 3 4 5; do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
    kill -9 "$pid" 2>/dev/null || true
    ok "已停止上次启动的$name (PID $pid)"
  fi
  rm -f "$file"
}

wait_http() {
  local url="$1" seconds="$2"
  for _ in $(seq 1 "$seconds"); do
    curl -s -o /dev/null -m 2 "$url" && return 0
    sleep 1
  done
  return 1
}

echo -e "${BLUE}════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  晨读营 - 本地开发环境启动${NC}"
echo -e "${BLUE}════════════════════════════════════════════════${NC}"

# ---------------------------------------------------------------------------
step "1/6 检查运行环境"
command -v node >/dev/null || fail "未安装 Node.js（需要 v20+）"
ok "Node $(node -v)"
for dir in "$BACKEND_DIR" "$ADMIN_DIR"; do
  if [ ! -d "$dir/node_modules" ]; then
    warn "$(basename "$dir") 缺少依赖，正在 npm install ..."
    (cd "$dir" && npm install --no-audit --no-fund >"$LOG_DIR/npm-install-$(basename "$dir").log" 2>&1) \
      || fail "$(basename "$dir") 依赖安装失败，见 $LOG_DIR/npm-install-$(basename "$dir").log"
  fi
done
ok "后端和管理后台依赖已就绪"

# ---------------------------------------------------------------------------
step "2/6 检查 MongoDB 和 Redis"
if ! port_open 27017; then
  warn "MongoDB 未运行，尝试通过 brew 启动 ..."
  formula=$(brew services list 2>/dev/null | awk '/^mongodb-community/{print $1; exit}')
  [ -n "${formula:-}" ] && brew services start "$formula" >/dev/null 2>&1
  for _ in $(seq 1 15); do port_open 27017 && break; sleep 1; done
fi
port_open 27017 && ok "MongoDB 运行中 (27017)" || fail "MongoDB 未启动，请手动执行：brew services start mongodb-community"

if ! redis-cli -p 6379 ping >/dev/null 2>&1; then
  warn "Redis 未运行，尝试启动 ..."
  brew services start redis >/dev/null 2>&1 || redis-server --daemonize yes --port 6379 >/dev/null 2>&1
  for _ in $(seq 1 10); do redis-cli -p 6379 ping >/dev/null 2>&1 && break; sleep 1; done
fi
redis-cli -p 6379 ping >/dev/null 2>&1 && ok "Redis 运行中 (6379)" || fail "Redis 未启动，请手动执行：brew services start redis"

# ---------------------------------------------------------------------------
step "3/6 检查后端本地配置"
if [ ! -f "$BACKEND_DIR/.env.local" ]; then
  touch "$BACKEND_DIR/.env.local"
  warn "已创建空的 backend/.env.local"
fi
# 新版鉴权要求 5 个互不相同、≥32 位的签名密钥；缺失时自动生成到 .env.local（仅本机）
ENV_REPORT=$(cd "$BACKEND_DIR" && node -e "
const fs=require('fs'),crypto=require('crypto'),dotenv=require('dotenv');
const env={};Object.assign(env,dotenv.parse(fs.existsSync('.env.local')?fs.readFileSync('.env.local'):''));
Object.assign(env,dotenv.parse(fs.existsSync('.env')?fs.readFileSync('.env'):''));   // .env 先加载，优先级更高
const keys=['JWT_SECRET','JWT_REFRESH_SECRET','JWT_WS_SECRET','JWT_ADMIN_SECRET','JWT_ADMIN_REFRESH_SECRET'];
const add=[];const blocked=[];
for(const k of keys){const v=env[k]||'';const strong=v.length>=32&&!/^(your-|dev-|test-|password|change_me|replace_me)/i.test(v);
  if(strong) continue;
  const inEnv=dotenv.parse(fs.existsSync('.env')?fs.readFileSync('.env'):'')[k];
  if(inEnv){blocked.push(k);continue;}
  add.push(k+'='+crypto.randomBytes(32).toString('hex'));}
if(!env.EXTERNAL_API_KEY_ENCRYPTION_KEY) add.push('EXTERNAL_API_KEY_ENCRYPTION_KEY='+crypto.randomBytes(32).toString('base64'));
if(add.length) fs.appendFileSync('.env.local','\n# ---- start-all-local.sh 自动生成的本地密钥 ----\n'+add.join('\n')+'\n');
console.log('added='+add.map(a=>a.split('=')[0]).join(','));
console.log('blocked='+blocked.join(','));
console.log('mongo='+(env.MONGODB_URI||''));
")
added=$(echo "$ENV_REPORT" | sed -n 's/^added=//p')
blocked=$(echo "$ENV_REPORT" | sed -n 's/^blocked=//p')
MONGO_URI=$(echo "$ENV_REPORT" | sed -n 's/^mongo=//p')
[ -n "$added" ] && warn "已在 backend/.env.local 生成本地密钥：$added"
if [ -n "$blocked" ]; then
  fail "backend/.env 中这些密钥太弱，会覆盖 .env.local：$blocked
     请在 backend/.env 里把它们注释掉（在行首加 #），再重新运行本脚本"
fi
ok "签名密钥齐全"

MONGO_URI="${MONGO_URI:-mongodb://127.0.0.1:27017/morning_reading_db}"
DB_REPORT=$(cd "$BACKEND_DIR" && MONGO_URI="$MONGO_URI" node -e "
const {MongoClient}=require('mongodb');
(async()=>{const c=await MongoClient.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:3000});const db=c.db();
const n=async x=>db.collection(x).countDocuments();
console.log(db.databaseName+' 租户='+await n('tenants')+' 管理员='+await n('admins')+' 用户='+await n('users')+' 期次='+await n('periods'));
await c.close();})().catch(e=>{console.log('ERROR '+e.message)})")
if [[ "$DB_REPORT" == ERROR* ]]; then
  fail "无法连接数据库：${DB_REPORT#ERROR }"
elif [[ "$DB_REPORT" == *"租户=0"* ]]; then
  warn "数据库 $DB_REPORT"
  warn "数据库没有租户数据，后台和小程序会无法登录。本脚本不会初始化数据库，"
  warn "请确认 backend/.env.local 的 MONGODB_URI 指向有数据的开发库（如 morning_reading_db）"
else
  ok "数据库 $DB_REPORT"
fi

# ---------------------------------------------------------------------------
step "4/6 启动后端 (端口 $BACKEND_PORT)"
stop_pidfile backend 后端
pid=$(port_pid "$BACKEND_PORT")
if [ -n "$pid" ]; then
  if is_ours "$pid"; then
    kill "$pid" 2>/dev/null; sleep 2; ok "已停止占用 $BACKEND_PORT 的旧后端 (PID $pid)"
  else
    fail "端口 $BACKEND_PORT 被其他程序占用 (PID $pid)，请先关闭它"
  fi
fi
(cd "$BACKEND_DIR" && nohup node src/server.js >"$LOG_DIR/backend.log" 2>&1 & echo $! >"$RUN_DIR/backend.pid")
if wait_http "http://localhost:$BACKEND_PORT/api/v1/health" 40; then
  port_pid "$BACKEND_PORT" >"$RUN_DIR/backend.pid"   # 记录真正监听端口的进程
  ok "后端已启动 (PID $(cat "$RUN_DIR/backend.pid"))"
  grep -q "MySQL connection error" "$LOG_DIR/backend.log" && warn "MySQL 连接失败：只影响备份同步，不影响功能测试"
else
  echo -e "${RED}  ✗ 后端启动失败，最后 30 行日志：${NC}"
  tail -30 "$LOG_DIR/backend.log"
  exit 1
fi

# ---------------------------------------------------------------------------
if $START_ADMIN; then
  step "5/6 启动管理后台"
  stop_pidfile admin 管理后台
  port="$ADMIN_PORT"
  for _ in $(seq 1 10); do
    pid=$(port_pid "$port")
    [ -z "$pid" ] && break
    if is_ours "$pid"; then kill "$pid" 2>/dev/null; sleep 1; break; fi
    warn "端口 $port 被其他程序占用，改用 $((port + 1))"
    port=$((port + 1))
  done
  ADMIN_PORT="$port"
  (cd "$ADMIN_DIR" && nohup node node_modules/vite/bin/vite.js --port "$ADMIN_PORT" --strictPort >"$LOG_DIR/admin.log" 2>&1 & echo $! >"$RUN_DIR/admin.pid")
  if wait_http "http://localhost:$ADMIN_PORT/" 30; then
    port_pid "$ADMIN_PORT" >"$RUN_DIR/admin.pid"
    echo "$ADMIN_PORT" >"$RUN_DIR/admin.port"
    ok "管理后台已启动 (PID $(cat "$RUN_DIR/admin.pid"))"
  else
    echo -e "${RED}  ✗ 管理后台启动失败，最后 30 行日志：${NC}"; tail -30 "$LOG_DIR/admin.log"; exit 1
  fi
else
  step "5/6 跳过管理后台 (--no-admin)"
fi

# ---------------------------------------------------------------------------
step "6/6 小程序"
if $MINI_DEV; then
  sed -i '' -E "s/^const currentEnv = '[a-z]+';.*/const currentEnv = 'dev'; \/\/ ⚠️ 本地测试用，上传发布前必须改回 'prod'/" "$ENV_JS"
fi
MINI_ENV=$(sed -nE "s/^const currentEnv = '([a-z]+)'.*/\1/p" "$ENV_JS")
if [ "$MINI_ENV" = "dev" ]; then
  ok "env.js = 'dev'：小程序连接本地后端，开发者工具里会自动模拟登录"
  warn "上传发布前必须改回 'prod'（bash stop-all-local.sh --mini-prod），上传脚本也会拦截"
else
  warn "env.js = '$MINI_ENV'：小程序仍连接【线上】后端。要测本地请加 --mini-dev 重新运行"
fi

# ---------------------------------------------------------------------------
echo -e "\n${GREEN}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ 本地环境已就绪${NC}"
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo "  后端 API     http://localhost:$BACKEND_PORT/api/v1"
$START_ADMIN && echo "  管理后台     http://localhost:$ADMIN_PORT"
$START_ADMIN && echo "               账号 admin@morningreading.com，密码见 backend/.env 的 ADMIN_DEFAULT_PASSWORD"
echo "  小程序       微信开发者工具打开项目根目录（env.js = '$MINI_ENV'）"
echo ""
echo "  日志         tail -f logs/local/backend.log   |   tail -f logs/local/admin.log"
echo "  重启后端     改了后端代码后重新运行本脚本即可"
echo "  停止         bash stop-all-local.sh"
