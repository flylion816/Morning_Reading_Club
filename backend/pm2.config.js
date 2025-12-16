/**
 * PM2 生产环境配置
 *
 * 用于在生产环境中通过 PM2 进程管理器启动和管理 Node.js 应用
 *
 * 启动方法：
 *   pm2 start pm2.config.js --env production
 *
 * 常用命令：
 *   pm2 start pm2.config.js                  # 启动应用
 *   pm2 stop morning-reading-backend         # 停止应用
 *   pm2 restart morning-reading-backend      # 重启应用
 *   pm2 logs morning-reading-backend         # 查看日志
 *   pm2 status                                # 查看应用状态
 *   pm2 save                                  # 保存PM2配置（开机自启）
 *   pm2 startup                               # 配置开机自启
 */

module.exports = {
  apps: [
    {
      // =====================================================================
      // 应用基本信息
      // =====================================================================
      name: 'morning-reading-backend',
      description: '晨读营后端服务',
      script: './src/server.js',
      namespace: 'morning-reading',

      // =====================================================================
      // 环境配置
      // =====================================================================
      instances: 'max', // 实例数：max 表示自动检测 CPU 核心数
      exec_mode: 'cluster', // 执行模式：cluster（集群）或 fork（单进程）
      max_memory_restart: '500M', // 内存超过 500MB 时自动重启

      // =====================================================================
      // 环境变量
      // =====================================================================
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3000
      },

      // =====================================================================
      // 日志配置
      // =====================================================================
      output: './logs/out.log', // 标准输出日志
      error: './logs/error.log', // 错误日志
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z', // 日志时间格式
      log_file: './logs/pm2.log', // PM2 事件日志
      log: './logs/combined.log', // 合并日志

      // =====================================================================
      // 监听文件变化（仅开发环境）
      // =====================================================================
      watch: ['src'], // 监听 src 目录变化
      ignore_watch: ['node_modules', 'logs', 'uploads'], // 忽略这些目录
      watch_delay: 1000, // 文件变化后延迟 1 秒重启
      watch_delay: 1000, // 防抖延迟

      // =====================================================================
      // 重启策略
      // =====================================================================
      max_restarts: 10, // 最多重启 10 次
      min_uptime: '10s', // 最小运行时间，低于此时间重启不计入 max_restarts
      listen_timeout: 10000, // 监听超时（毫秒）
      kill_timeout: 5000, // 强制杀死前等待时间

      // =====================================================================
      // 进程优化
      // =====================================================================
      node_args: [
        '--max-old-space-size=2048', // 堆内存 2GB
        '--enable-source-maps' // 启用源地图支持
      ],

      // =====================================================================
      // 自动重启条件
      // =====================================================================
      autorestart: true, // 自动重启崩溃的进程
      autostart: true, // 开机自启
      exp_backoff_restart_delay: 100, // 重启延迟的指数退避

      // =====================================================================
      // 内置健康检查
      // =====================================================================
      listen_timeout: 10000, // 应用启动超时（毫秒）

      // =====================================================================
      // 集群模式下的额外配置
      // =====================================================================
      wait_ready: false, // 等待应用发送 ready 信号
      shutdown_with_message: true, // 关闭时使用消息而不是信号

      // =====================================================================
      // 其他配置
      // =====================================================================
      cwd: process.cwd(), // 工作目录
      interpreter: 'node', // 解释器
      interpreter_args: '', // 解释器参数
      args: '', // 应用参数
      merge_logs: true, // 合并所有进程的日志
      max_clients: null, // 不限制最大客户端数

      // =====================================================================
      // 基础设施配置
      // =====================================================================
      uid: null, // 用户ID（如果需要以特定用户运行）
      gid: null // 组ID
    }
  ],

  // =====================================================================
  // 全局配置
  // =====================================================================
  deploy: {
    production: {
      user: 'node',
      host: process.env.DEPLOY_HOST || 'your-server.com',
      ref: 'origin/main',
      repo: 'https://github.com/flylion816/Morning_Reading_Club.git',
      path: '/var/www/morning-reading-backend',
      'post-deploy': 'npm install && npm run build && pm2 start pm2.config.js --env production',
      'pre-deploy-local': 'echo "Deploying to production"'
    },
    staging: {
      user: 'node',
      host: process.env.DEPLOY_HOST_STAGING || 'staging-server.com',
      ref: 'origin/develop',
      repo: 'https://github.com/flylion816/Morning_Reading_Club.git',
      path: '/var/www/morning-reading-backend-staging',
      'post-deploy': 'npm install && npm run build && pm2 start pm2.config.js --env staging'
    }
  },

  // =====================================================================
  // 监控配置（需要 PM2 Plus）
  // =====================================================================
  pmx: true, // 启用 PMX 监控
  instance_var: 'INSTANCE_ID' // 实例变量名称
};
