const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
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

const app = express();

// 中间件
app.use(helmet()); // 安全头
app.use(cors()); // 跨域
app.use(compression()); // 响应压缩
app.use(morgan('dev')); // 请求日志
app.use(express.json()); // JSON解析
app.use(express.urlencoded({ extended: true })); // URL编码解析

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// API路由
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/periods', periodRoutes);
app.use('/api/v1/sections', sectionRoutes);
app.use('/api/v1/checkins', checkinRoutes);
app.use('/api/v1/insights', insightRoutes);
app.use('/api/v1/comments', commentRoutes);

// 404处理
app.use(notFoundHandler);

// 错误处理
app.use(errorHandler);

module.exports = app;
