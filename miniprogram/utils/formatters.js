/**
 * 格式化工具函数
 * 提供日期、时间、数字等格式化功能
 */

/**
 * 格式化日期
 * @param {Date|string|number} date 日期对象、日期字符串或时间戳
 * @param {string} format 格式化模板,默认 'YYYY-MM-DD'
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date, format = 'YYYY-MM-DD') {
  if (!date) return '';

  let d = new Date(date);

  if (isNaN(d.getTime())) {
    console.error('无效的日期:', date);
    return '';
  }

  // 如果是ISO字符串，使用UTC解析而不是本地时区
  // 这样才能与后端返回的日期保持一致（后端使用UTC）
  if (typeof date === 'string' && date.includes('T')) {
    // 例如："2025-11-20T00:00:00Z" 或 "2025-11-20T00:00:00.000Z"
    const utcString = date;
    const match = utcString.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      // 直接从字符串提取日期部分，避免时区转换
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);

      const formatMap = {
        'YYYY': year,
        'MM': String(month).padStart(2, '0'),
        'DD': String(day).padStart(2, '0'),
        'HH': String(d.getUTCHours()).padStart(2, '0'),
        'mm': String(d.getUTCMinutes()).padStart(2, '0'),
        'ss': String(d.getUTCSeconds()).padStart(2, '0')
      };

      let result = format;
      Object.keys(formatMap).forEach(key => {
        result = result.replace(key, formatMap[key]);
      });

      return result;
    }
  }

  // 对于非ISO字符串或时间戳，使用本地时区
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  const second = String(d.getSeconds()).padStart(2, '0');

  const formatMap = {
    'YYYY': year,
    'MM': month,
    'DD': day,
    'HH': hour,
    'mm': minute,
    'ss': second
  };

  let result = format;
  Object.keys(formatMap).forEach(key => {
    result = result.replace(key, formatMap[key]);
  });

  return result;
}

/**
 * 格式化相对时间(多久以前)
 * @param {Date|string|number} timestamp 时间戳
 * @returns {string} 相对时间字符串
 */
function formatTimeAgo(timestamp) {
  if (!timestamp) return '';

  const now = Date.now();
  const time = new Date(timestamp).getTime();

  if (isNaN(time)) {
    return '';
  }

  const diff = Math.floor((now - time) / 1000); // 秒

  if (diff < 60) {
    return '刚刚';
  }

  if (diff < 3600) {
    return `${Math.floor(diff / 60)}分钟前`;
  }

  if (diff < 86400) {
    return `${Math.floor(diff / 3600)}小时前`;
  }

  if (diff < 2592000) {
    // 30天内
    return `${Math.floor(diff / 86400)}天前`;
  }

  // 超过30天显示具体日期
  return formatDate(timestamp, 'YYYY-MM-DD');
}

/**
 * 格式化数字(大数字缩写)
 * @param {number} num 数字
 * @returns {string} 格式化后的字符串
 */
function formatNumber(num) {
  if (typeof num !== 'number') {
    return '0';
  }

  if (num >= 100000000) {
    return (num / 100000000).toFixed(1) + '亿';
  }

  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }

  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }

  return num.toString();
}

/**
 * 截断文本
 * @param {string} text 文本
 * @param {number} length 最大长度
 * @param {string} suffix 后缀,默认 '...'
 * @returns {string} 截断后的文本
 */
function truncateText(text, length = 50, suffix = '...') {
  if (!text || typeof text !== 'string') {
    return '';
  }

  if (text.length <= length) {
    return text;
  }

  return text.substring(0, length) + suffix;
}

/**
 * 格式化百分比
 * @param {number} value 数值
 * @param {number} total 总数
 * @param {number} decimals 小数位数
 * @returns {string} 百分比字符串
 */
function formatPercentage(value, total, decimals = 0) {
  if (!total || total === 0) {
    return '0%';
  }

  const percentage = (value / total) * 100;
  return percentage.toFixed(decimals) + '%';
}

/**
 * 格式化文件大小
 * @param {number} bytes 字节数
 * @returns {string} 格式化后的文件大小
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + units[i];
}

/**
 * 格式化手机号(中间隐藏)
 * @param {string} phone 手机号
 * @returns {string} 格式化后的手机号
 */
function formatPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return '';
  }

  if (phone.length !== 11) {
    return phone;
  }

  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

/**
 * 格式化金额(千分位)
 * @param {number} amount 金额
 * @param {number} decimals 小数位数
 * @returns {string} 格式化后的金额
 */
function formatMoney(amount, decimals = 2) {
  if (typeof amount !== 'number') {
    return '0.00';
  }

  return amount.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 补零(数字前面补0)
 * @param {number} num 数字
 * @param {number} length 总长度
 * @returns {string} 补零后的字符串
 */
function padZero(num, length = 2) {
  return String(num).padStart(length, '0');
}

/**
 * 格式化时间段(开始-结束)
 * @param {string} startDate 开始日期
 * @param {string} endDate 结束日期
 * @returns {string} 时间段字符串
 */
function formatDateRange(startDate, endDate) {
  if (!startDate || !endDate) {
    return '';
  }

  const start = formatDate(startDate, 'YYYY-MM-DD');
  const end = formatDate(endDate, 'YYYY-MM-DD');

  return `${start} 至 ${end}`;
}

/**
 * 解析查询字符串
 * @param {string} query 查询字符串
 * @returns {Object} 参数对象
 */
function parseQuery(query) {
  const params = {};

  if (!query) {
    return params;
  }

  const pairs = query.split('&');
  pairs.forEach(pair => {
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
  });

  return params;
}

/**
 * 根据userId生成稳定的头像颜色
 * 同一个userId总是返回相同的颜色
 * @param {string} userId 用户ID
 * @returns {string} 16进制颜色值
 */
function getAvatarColorByUserId(userId) {
  const colors = [
    '#4a90e2',  // 蓝色
    '#7ed321',  // 绿色
    '#f5a623',  // 橙色
    '#bd10e0',  // 紫色
    '#50e3c2',  // 青色
    '#d0021b',  // 红色
    '#f8e71c',  // 黄色
    '#417505'   // 深绿色
  ];

  if (!userId) {
    return colors[0];
  }

  // 简单的哈希函数：将userId字符串转换为数字
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // 使用绝对值确保结果为正数
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

module.exports = {
  formatDate,
  formatTimeAgo,
  formatNumber,
  truncateText,
  formatPercentage,
  formatFileSize,
  formatPhone,
  formatMoney,
  padZero,
  formatDateRange,
  parseQuery,
  getAvatarColorByUserId
};
