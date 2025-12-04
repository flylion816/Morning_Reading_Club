# 多阶段构建：生产级别 Node.js 后端镜像
# Stage 1: 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖（包括 devDependencies）
RUN npm ci --prefer-offline --no-audit

# 复制源代码
COPY . .

# 运行构建（如果需要）
# RUN npm run build

# ============================================================================
# Stage 2: 运行阶段（最终镜像）
FROM node:20-alpine

LABEL maintainer="Morning Reading Club Team"
LABEL version="1.0.0"
LABEL description="晨读营小程序后端服务"

WORKDIR /app

# 安装 dumb-init（正确处理信号）
RUN apk add --no-cache dumb-init

# 从构建阶段复制 node_modules
COPY --from=builder /app/node_modules ./node_modules

# 复制构建产物和源代码
COPY --from=builder /app/src ./src
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/pm2.config.js ./

# 创建日志和上传目录
RUN mkdir -p /app/logs /app/uploads && chmod 755 /app/logs /app/uploads

# 设置环境变量（默认值）
ENV NODE_ENV=production
ENV PORT=3000
ENV NPM_CONFIG_LOGLEVEL=warn

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# 创建非 root 用户运行应用
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# 使用 dumb-init 作为入口点（确保正确处理信号）
ENTRYPOINT ["/sbin/dumb-init", "--"]

# 启动应用
CMD ["node", "src/server.js"]
