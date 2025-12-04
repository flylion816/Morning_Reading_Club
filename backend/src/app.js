const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// 导入路由
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const periodRoutes = require('./routes/period.routes');
const sectionRoutes = require('./routes/section.routes');
const checkinRoutes = require('./routes/checkin.routes');
const insightRoutes = require('./routes/insight.routes');
const commentRoutes = require('./routes/comment.routes');
const enrollmentRoutes = require('./routes/enrollment.routes');
const paymentRoutes = require('./routes/payment.routes');
const rankingRoutes = require('./routes/ranking.routes');
const adminRoutes = require('./routes/admin.routes');
const uploadRoutes = require('./routes/upload.routes');
const statsRoutes = require('./routes/stats.routes');
const auditRoutes = require('./routes/audit.routes');
const notificationRoutes = require('./routes/notification.routes');
const healthRoutes = require('./routes/health.routes');

const app = express();

// 中间件
app.use(helmet()); // 安全头
app.use(cors()); // 跨域
app.use(compression()); // 响应压缩
app.use(morgan('dev')); // 请求日志
app.use(express.json()); // JSON解析
app.use(express.urlencoded({ extended: true })); // URL编码解析

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 健康检查路由 - 不需要认证的公开端点
app.use('/', healthRoutes);
app.use('/api/v1', healthRoutes);

// API路由
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', adminRoutes); // Admin routes (auth endpoints are here)
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/periods', periodRoutes);
app.use('/api/v1/sections', sectionRoutes);
app.use('/api/v1/checkins', checkinRoutes);
app.use('/api/v1/insights', insightRoutes);
app.use('/api/v1/comments', commentRoutes);
app.use('/api/v1/enrollments', enrollmentRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/ranking', rankingRoutes);
app.use('/api/v1/stats', statsRoutes); // 统计数据API
app.use('/api/v1/audit-logs', auditRoutes); // 审计日志API
app.use('/api/v1/notifications', notificationRoutes); // 通知API
app.use('/api/v1/upload', uploadRoutes);

// 404处理
app.use(notFoundHandler);

// 错误处理
app.use(errorHandler);

module.exports = app;
