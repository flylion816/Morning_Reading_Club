const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const { getCorsOptions } = require('./config/cors');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { monitoringMiddleware } = require('./middleware/monitoring');
const auditLogMiddleware = require('./middleware/auditLog');

const authRoutes = require('./routes/auth.routes');
const monitoringRoutes = require('./routes/monitoring.routes');
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
const backupRoutes = require('./routes/backup.routes');
const meetingRoutes = require('./routes/meeting.routes');
const activityRoutes = require('./routes/activity.routes');
const checkinConfigRoutes = require('./routes/checkinConfig.routes');
const wechatRoutes = require('./routes/wechat.routes');
const imprintRoutes = require('./routes/imprint.routes');

const app = express();

// 信任 Nginx 反向代理，使 req.ip 返回真实客户端 IP（来自 X-Forwarded-For）
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors(getCorsOptions()));
app.use(compression());
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ type: ['text/xml', 'application/xml'] }));

const uploadRoot = path.join(__dirname, '../uploads');
app.use(
  '/uploads/tenants',
  express.static(path.join(uploadRoot, 'tenants'), {
    fallthrough: false,
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
    setHeaders(res) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  })
);

app.use((req, res, next) => {
  req.wsManager = app.locals.wsManager;
  next();
});

app.use(monitoringMiddleware({ enabled: true }));

app.use('/', healthRoutes);
app.use('/api/v1', healthRoutes);
app.use('/', meetingRoutes);

app.use(auditLogMiddleware);

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
app.use('/api/v1/stats', statsRoutes);
app.use('/api/v1/audit-logs', auditRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/monitoring', monitoringRoutes);
app.use('/api/v1/backup', backupRoutes);
app.use('/api/v1/activities', activityRoutes);
app.use('/api/v1/checkin-celebration-config', checkinConfigRoutes);
app.use('/api/v1/wechat', wechatRoutes);
app.use('/api/v1/imprints', imprintRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
