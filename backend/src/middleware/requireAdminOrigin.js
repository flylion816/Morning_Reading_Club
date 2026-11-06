const { errors } = require('../utils/response');

/** Protect cookie-backed administrator endpoints from cross-origin requests. */
function requireAdminOrigin(req, res, next) {
  const origin = req.get('origin');
  if (!origin) {
    return res.status(403).json(errors.forbidden('缺少管理员页面来源校验'));
  }

  try {
    const parsedOrigin = new URL(origin);
    const expectedOrigin = `${req.protocol}://${req.get('host')}`;
    const allowedOrigins = new Set([
      expectedOrigin,
      process.env.ADMIN_URL,
      ...(process.env.ADMIN_ALLOWED_ORIGINS || '').split(',').map(value => value.trim())
    ].filter(Boolean));
    if (process.env.NODE_ENV !== 'production') {
      const requestHost = new URL(`${req.protocol}://${req.get('host')}`);
      const loopbackHosts = new Set(['localhost', '127.0.0.1']);
      if (
        parsedOrigin.protocol === 'http:' &&
        requestHost.protocol === 'http:' &&
        loopbackHosts.has(parsedOrigin.hostname) &&
        parsedOrigin.hostname === requestHost.hostname
      ) {
        allowedOrigins.add(parsedOrigin.origin);
      }
    }
    if (!allowedOrigins.has(parsedOrigin.origin)) {
      return res.status(403).json(errors.forbidden('管理员页面来源不匹配'));
    }
  } catch (_) {
    return res.status(403).json(errors.forbidden('管理员页面来源无效'));
  }

  return next();
}

module.exports = requireAdminOrigin;
