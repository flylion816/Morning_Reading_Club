const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * 管理员身份验证中间件
 * 验证请求中的 JWT Token
 */
function adminAuthMiddleware(req, res, next) {
  try {
    // 从 Authorization header 中获取 token
    const authHeader = req.headers.authorization
    if (!authHeader) {
      return res.status(401).json({
        code: 401,
        message: '未提供认证令牌'
      })
    }

    // 提取 Bearer token
    const parts = authHeader.split(' ')
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        code: 401,
        message: '无效的认证令牌格式'
      })
    }

    const token = parts[1]

    // 验证 token
    jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key',
      (err, decoded) => {
        if (err) {
          return res.status(401).json({
            code: 401,
            message: '令牌已过期或无效'
          })
        }

        // 将解析后的 token 信息存储到 req.admin
        req.admin = decoded

        next()
      }
    )
  } catch (error) {
    logger.error('Auth middleware error:', error)
    return res.status(500).json({
      code: 500,
      message: '认证失败'
    })
  }
}

/**
 * 角色检查中间件
 * 检查用户是否具有特定角色
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        code: 401,
        message: '未授权'
      })
    }

    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({
        code: 403,
        message: '权限不足'
      })
    }

    next()
  }
}

/**
 * 权限检查中间件
 * 检查用户是否具有特定权限
 */
function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        code: 401,
        message: '未授权'
      })
    }

    // 超级管理员拥有所有权限
    if (req.admin.role === 'superadmin') {
      return next()
    }

    const hasPermission = permissions.some(permission =>
      req.admin.permissions?.includes(permission)
    )

    if (!hasPermission) {
      return res.status(403).json({
        code: 403,
        message: '权限不足'
      })
    }

    next()
  }
}

module.exports = {
  adminAuthMiddleware,
  requireRole,
  requirePermission
}
