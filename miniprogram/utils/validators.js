/**
 * 验证工具函数
 * 提供常用的数据验证功能
 */

/**
 * 验证是否为空
 * @param {any} value 待验证的值
 * @returns {boolean}
 */
function isEmpty(value) {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim() === '';
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }

  return false;
}

/**
 * 验证邮箱
 * @param {string} email 邮箱地址
 * @returns {boolean}
 */
function isEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * 验证手机号(中国大陆)
 * @param {string} phone 手机号
 * @returns {boolean}
 */
function isPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  const regex = /^1[3-9]\d{9}$/;
  return regex.test(phone);
}

/**
 * 验证身份证号(中国大陆)
 * @param {string} idCard 身份证号
 * @returns {boolean}
 */
function isIdCard(idCard) {
  if (!idCard || typeof idCard !== 'string') {
    return false;
  }

  // 18位身份证号码正则
  const regex =
    /^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/;
  return regex.test(idCard);
}

/**
 * 验证URL
 * @param {string} url URL地址
 * @returns {boolean}
 */
function isUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 验证字符串长度
 * @param {string} value 字符串
 * @param {number} min 最小长度
 * @param {number} max 最大长度
 * @returns {boolean}
 */
function isValidLength(value, min = 0, max = Infinity) {
  if (typeof value !== 'string') {
    return false;
  }

  const length = value.length;
  return length >= min && length <= max;
}

/**
 * 验证数字范围
 * @param {number} value 数字
 * @param {number} min 最小值
 * @param {number} max 最大值
 * @returns {boolean}
 */
function isInRange(value, min = -Infinity, max = Infinity) {
  if (typeof value !== 'number' || isNaN(value)) {
    return false;
  }

  return value >= min && value <= max;
}

/**
 * 验证是否为正整数
 * @param {any} value 待验证的值
 * @returns {boolean}
 */
function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

/**
 * 验证是否为数字
 * @param {any} value 待验证的值
 * @returns {boolean}
 */
function isNumber(value) {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * 验证是否只包含中文
 * @param {string} value 字符串
 * @returns {boolean}
 */
function isChinese(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }

  const regex = /^[\u4e00-\u9fa5]+$/;
  return regex.test(value);
}

/**
 * 验证是否只包含字母
 * @param {string} value 字符串
 * @returns {boolean}
 */
function isAlpha(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }

  const regex = /^[a-zA-Z]+$/;
  return regex.test(value);
}

/**
 * 验证是否只包含字母和数字
 * @param {string} value 字符串
 * @returns {boolean}
 */
function isAlphanumeric(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }

  const regex = /^[a-zA-Z0-9]+$/;
  return regex.test(value);
}

/**
 * 验证日期格式(YYYY-MM-DD)
 * @param {string} date 日期字符串
 * @returns {boolean}
 */
function isDate(date) {
  if (!date || typeof date !== 'string') {
    return false;
  }

  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(date)) {
    return false;
  }

  // 验证日期是否有效
  const d = new Date(date);
  return !isNaN(d.getTime());
}

/**
 * 验证时间格式(HH:mm 或 HH:mm:ss)
 * @param {string} time 时间字符串
 * @returns {boolean}
 */
function isTime(time) {
  if (!time || typeof time !== 'string') {
    return false;
  }

  const regex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
  return regex.test(time);
}

/**
 * 验证密码强度
 * @param {string} password 密码
 * @param {Object} options 配置选项
 * @returns {Object} 验证结果 {valid: boolean, strength: string, message: string}
 */
function validatePassword(password, options = {}) {
  const {
    minLength = 6,
    maxLength = 20,
    requireUppercase = false,
    requireLowercase = false,
    requireNumber = false,
    requireSpecialChar = false
  } = options;

  const result = {
    valid: true,
    strength: 'weak',
    message: ''
  };

  // 检查长度
  if (password.length < minLength) {
    result.valid = false;
    result.message = `密码长度至少${minLength}位`;
    return result;
  }

  if (password.length > maxLength) {
    result.valid = false;
    result.message = `密码长度不能超过${maxLength}位`;
    return result;
  }

  // 检查是否包含大写字母
  if (requireUppercase && !/[A-Z]/.test(password)) {
    result.valid = false;
    result.message = '密码必须包含大写字母';
    return result;
  }

  // 检查是否包含小写字母
  if (requireLowercase && !/[a-z]/.test(password)) {
    result.valid = false;
    result.message = '密码必须包含小写字母';
    return result;
  }

  // 检查是否包含数字
  if (requireNumber && !/\d/.test(password)) {
    result.valid = false;
    result.message = '密码必须包含数字';
    return result;
  }

  // 检查是否包含特殊字符
  // eslint-disable-next-line no-useless-escape
  if (requireSpecialChar && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    result.valid = false;
    result.message = '密码必须包含特殊字符';
    return result;
  }

  // 计算密码强度
  let strengthScore = 0;
  if (/[A-Z]/.test(password)) strengthScore++;
  if (/[a-z]/.test(password)) strengthScore++;
  if (/\d/.test(password)) strengthScore++;
  // eslint-disable-next-line no-useless-escape
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) strengthScore++;

  if (strengthScore >= 4) {
    result.strength = 'strong';
  } else if (strengthScore >= 3) {
    result.strength = 'medium';
  } else {
    result.strength = 'weak';
  }

  return result;
}

module.exports = {
  isEmpty,
  isEmail,
  isPhone,
  isIdCard,
  isUrl,
  isValidLength,
  isInRange,
  isPositiveInteger,
  isNumber,
  isChinese,
  isAlpha,
  isAlphanumeric,
  isDate,
  isTime,
  validatePassword
};
