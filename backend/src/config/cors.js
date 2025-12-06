/**
 * CORS (Cross-Origin Resource Sharing) 配置
 * 用于控制跨域请求的安全性
 */

// 开发环境的允许源
const developmentOrigins = [
  'http://localhost:3000',      // 后端本身
  'http://localhost:5173',      // Admin Vue (Vite默认端口)
  'http://localhost:4173',      // Admin Vue (Vite preview端口)
  'http://localhost:8080',      // 备用前端端口
];

// 生产环境的允许源
const getProductionOrigins = () => {
  const origins = [];

  // Admin 后台地址
  if (process.env.ADMIN_URL) {
    origins.push(process.env.ADMIN_URL);
  } else {
    origins.push('https://admin.morningreading.com');
  }

  // 小程序地址（如果配置）
  if (process.env.MINIPROGRAM_URL && process.env.MINIPROGRAM_URL !== '*') {
    origins.push(process.env.MINIPROGRAM_URL);
  }

  // API 自身地址
  if (process.env.API_BASE_URL) {
    origins.push(process.env.API_BASE_URL);
  } else {
    origins.push('https://api.morningreading.com');
  }

  return origins;
};

// 根据环境选择允许的源
const getAllowedOrigins = () => {
  if (process.env.NODE_ENV === 'production') {
    return getProductionOrigins();
  }
  return developmentOrigins;
};

/**
 * CORS 中间件配置
 * @returns {Object} Express CORS 中间件配置对象
 */
const getCorsOptions = () => {
  const allowedOrigins = getAllowedOrigins();

  return {
    origin: (origin, callback) => {
      // 允许无 origin 的请求（如 POST requests from HTML forms 或 curl requests）
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true, // 允许发送凭证（Cookie, Authorization Headers）
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Total-Pages', 'X-Current-Page'],
    maxAge: 3600, // 预检请求的缓存时间（秒）
  };
};

/**
 * Socket.IO CORS 配置
 * @returns {Object} Socket.IO CORS 配置对象
 */
const getSocketIoCorsOptions = () => {
  const allowedOrigins = getAllowedOrigins();

  return {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST'],
    transports: ['websocket', 'polling'],
  };
};

module.exports = {
  getCorsOptions,
  getSocketIoCorsOptions,
  getAllowedOrigins,
  developmentOrigins,
};
