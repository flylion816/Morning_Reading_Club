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
const courseTemplateRoutes = require('./routes/course-template.routes');
const enrollmentTemplateRoutes = require('./routes/enrollment-template.routes');
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
const mobileAdminAnalyticsRoutes = require('./routes/mobileAdminAnalytics.routes');
const mobileAdminWorkbenchRoutes = require('./routes/mobileAdminWorkbench.routes');
const checkinConfigRoutes = require('./routes/checkinConfig.routes');
const homeConfigRoutes = require('./routes/homeConfig.routes');
const wechatRoutes = require('./routes/wechat.routes');
const imprintRoutes = require('./routes/imprint.routes');
const { router: communityActivityRoutes, adminRouter: communityActivityAdminRoutes } = require('./routes/communityActivity.routes');
const { adminRouter: activityCouponAdminRoutes, userRouter: activityCouponUserRoutes } = require('./routes/activityCoupon.routes');

const app = express();

// 信任 Nginx 反向代理，使 req.ip 返回真实客户端 IP（来自 X-Forwarded-For）
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors(getCorsOptions()));
app.use(compression());
morgan.token('safe-url', req => String(req.originalUrl || '/').split('?')[0]);
morgan.token('safe-referrer-origin', req => {
  try { return new URL(req.get('referer')).origin; } catch (_) { return '-'; }
});
morgan.token('safe-user-agent', req => String(req.get('user-agent') || '-')
  .replace(/[\r\n\u2028\u2029]/g, ' ')
  .split('')
  .filter(character => {
    const code = character.charCodeAt(0);
    return code >= 0x20 && code !== 0x7f;
  })
  .join('')
  .slice(0, 240));
const safeMorganFormat = process.env.NODE_ENV === 'production'
  ? ':remote-addr :remote-user [:date[iso]] ":method :safe-url HTTP/:http-version" :status :res[content-length] ":safe-referrer-origin" ":safe-user-agent"'
  : 'dev';
app.use(morgan(safeMorganFormat));
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
app.use('/api/v1/course-templates', courseTemplateRoutes);
app.use('/api/v1/enrollment-templates', enrollmentTemplateRoutes);
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
app.use('/api/v1/mobile-admin/analytics', mobileAdminAnalyticsRoutes);
app.use('/api/v1/mobile-admin/workbench', mobileAdminWorkbenchRoutes);
app.use('/api/v1/checkin-celebration-config', checkinConfigRoutes);
app.use('/api/v1/home-config', homeConfigRoutes);
app.use('/api/v1/wechat', wechatRoutes);
app.use('/api/v1/imprints', imprintRoutes);
app.use('/api/v1/community-activities', communityActivityRoutes);
app.use('/api/v1/admin/community-activities', communityActivityAdminRoutes);
app.use('/api/v1/activity-coupons', activityCouponUserRoutes);
app.use('/api/v1/admin/activity-coupons', activityCouponAdminRoutes);
// 晨读营新功能（同行感、慢递邮局、纪念册、摘抄本、看见卡、实修、读伴）
app.use('/api/v1/presence', require('./routes/presence.routes'));
app.use('/api/v1/letters', require('./routes/letter.routes'));
app.use('/api/v1/keepsakes', require('./routes/keepsake.routes'));
app.use('/api/v1/highlights', require('./routes/highlight.routes'));
app.use('/api/v1/seen-cards', require('./routes/seenCard.routes'));
app.use('/api/v1/practices', require('./routes/practice.routes'));
app.use('/api/v1/buddies', require('./routes/buddy.routes'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
