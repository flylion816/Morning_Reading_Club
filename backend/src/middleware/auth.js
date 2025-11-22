const { verifyAccessToken } = require('../utils/jwt');
const { errors } = require('../utils/response');

// 认证中间件
function authMiddleware(req, res, next) {
  try {
    // 从请求头获取token
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errors.unauthorized('未提供认证令牌'));
    }

    const token = authHeader.substring(7);

    // 验证token
    const decoded = verifyAccessToken(token);

    // 将用户信息添加到请求对象
    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json(errors.unauthorized(error.message));
  }
}

// 可选认证中间件（不强制要求登录）
function optionalAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyAccessToken(token);
      req.user = decoded;
    }

    next();
  } catch (error) {
    // 验证失败也继续，但不设置req.user
    next();
  }
}

// 管理员权限中间件
function adminMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json(errors.unauthorized('未登录'));
  }

  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json(errors.forbidden('需要管理员权限'));
  }

  next();
}

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  adminMiddleware
};
