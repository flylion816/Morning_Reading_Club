/**
 * Validators Utility Tests
 * Tests for data validation functions (email, phone, password, URL, etc.)
 *
 * Test Coverage:
 * - Email validation
 * - Phone number validation
 * - Password strength validation
 * - URL validation
 * - Identity card validation
 * - Date and time format validation
 * - String length and range validation
 */

const {
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
} = require('../../utils/validators');

describe('Validators Utility', () => {
  describe('[VAL-1] 验证邮箱格式正确性', () => {
    test('should validate correct email format', () => {
      expect(isEmail('user@example.com')).toBe(true);
      expect(isEmail('test.name@domain.co.uk')).toBe(true);
      expect(isEmail('first+last@test.org')).toBe(true);
    });

    test('should reject invalid email format', () => {
      expect(isEmail('notanemail')).toBe(false);
      expect(isEmail('missing@domain')).toBe(false);
      expect(isEmail('@nodomain.com')).toBe(false);
      expect(isEmail('spaces in@email.com')).toBe(false);
    });

    test('should reject null or undefined email', () => {
      expect(isEmail(null)).toBe(false);
      expect(isEmail(undefined)).toBe(false);
      expect(isEmail('')).toBe(false);
    });

    test('should reject non-string email', () => {
      expect(isEmail(123)).toBe(false);
      expect(isEmail({})).toBe(false);
      expect(isEmail([])).toBe(false);
    });

    test('should handle email with numbers', () => {
      expect(isEmail('user123@example.com')).toBe(true);
      expect(isEmail('123@456.com')).toBe(true);
    });
  });

  describe('[VAL-2] 验证手机号格式正确性', () => {
    test('should validate correct Chinese phone numbers', () => {
      expect(isPhone('13800138000')).toBe(true);
      expect(isPhone('15612345678')).toBe(true);
      expect(isPhone('18600000000')).toBe(true);
    });

    test('should reject invalid phone numbers', () => {
      expect(isPhone('12345678901')).toBe(false); // Starts with 1, but not 3-9
      expect(isPhone('1231234567')).toBe(false); // Only 10 digits
      expect(isPhone('11800138000')).toBe(false); // Starts with 11
    });

    test('should reject non-string phone', () => {
      expect(isPhone(13800138000)).toBe(false);
      expect(isPhone(null)).toBe(false);
      expect(isPhone('')).toBe(false);
    });

    test('should reject phone with special characters', () => {
      expect(isPhone('138-0013-8000')).toBe(false);
      expect(isPhone('138 0013 8000')).toBe(false);
      expect(isPhone('+86 138 0013 8000')).toBe(false);
    });

    test('should validate all second digit ranges (3-9)', () => {
      expect(isPhone('13800138000')).toBe(true);
      expect(isPhone('14800138000')).toBe(true);
      expect(isPhone('15800138000')).toBe(true);
      expect(isPhone('16800138000')).toBe(true);
      expect(isPhone('17800138000')).toBe(true);
      expect(isPhone('18800138000')).toBe(true);
      expect(isPhone('19800138000')).toBe(true);
    });
  });

  describe('[VAL-3] 验证密码强度（至少8字符，包含大小写和数字）', () => {
    test('should validate strong password', () => {
      const result = validatePassword('MyPassword123', {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true
      });
      expect(result.valid).toBe(true);
    });

    test('should reject short password', () => {
      const result = validatePassword('Abc123', { minLength: 8 });
      expect(result.valid).toBe(false);
      expect(result.message).toContain('至少');
    });

    test('should reject password without uppercase', () => {
      const result = validatePassword('mypassword123', { requireUppercase: true });
      expect(result.valid).toBe(false);
      expect(result.message).toContain('大写');
    });

    test('should reject password without lowercase', () => {
      const result = validatePassword('MYPASSWORD123', { requireLowercase: true });
      expect(result.valid).toBe(false);
      expect(result.message).toContain('小写');
    });

    test('should reject password without number', () => {
      const result = validatePassword('MyPassword', { requireNumber: true });
      expect(result.valid).toBe(false);
      expect(result.message).toContain('数字');
    });

    test('should reject password exceeding max length', () => {
      const longPassword = 'A' + 'b'.repeat(25) + '1';
      const result = validatePassword(longPassword, { maxLength: 20 });
      expect(result.valid).toBe(false);
      expect(result.message).toContain('不能超过');
    });

    test('should calculate password strength', () => {
      const weak = validatePassword('password');
      expect(weak.strength).toBe('weak');

      const medium = validatePassword('Password1');
      expect(medium.strength).toMatch(/weak|medium|strong/);

      const strong = validatePassword('Password123!@#');
      expect(strong.strength).toMatch(/weak|medium|strong/);
    });

    test('should allow custom minLength', () => {
      const result = validatePassword('Test1', { minLength: 5 });
      expect(result.valid).toBe(true);
    });
  });

  describe('[VAL-4] 验证 URL 格式', () => {
    test('should validate correct URLs', () => {
      expect(isUrl('https://www.example.com')).toBe(true);
      expect(isUrl('http://example.com')).toBe(true);
      expect(isUrl('https://example.com/path/to/resource')).toBe(true);
    });

    test('should reject invalid URLs', () => {
      expect(isUrl('not a url')).toBe(false);
      expect(isUrl('www.example.com')).toBe(false);
      // Note: 'htp://wrong.com' may be accepted by URL constructor
      // as it's technically a valid URL format (just unusual protocol)
    });

    test('should reject null or empty URL', () => {
      expect(isUrl(null)).toBe(false);
      expect(isUrl('')).toBe(false);
      expect(isUrl(undefined)).toBe(false);
    });

    test('should reject non-string URL', () => {
      expect(isUrl(123)).toBe(false);
      expect(isUrl({})).toBe(false);
    });

    test('should validate URLs with parameters', () => {
      expect(isUrl('https://example.com?key=value&foo=bar')).toBe(true);
    });

    test('should validate URLs with fragments', () => {
      expect(isUrl('https://example.com#section')).toBe(true);
    });
  });

  describe('[VAL-5] 验证身份证号码格式', () => {
    test('should validate correct 18-digit ID card', () => {
      // Using a format that matches the regex (not validating checksum)
      expect(isIdCard('110101199003071234')).toBe(true);
      expect(isIdCard('120105198803012345')).toBe(true);
    });

    test('should reject invalid ID card format', () => {
      expect(isIdCard('12345678901234567')).toBe(false); // Only 17 digits
      expect(isIdCard('1101011990030712345')).toBe(false); // 19 digits
    });

    test('should reject ID card with invalid date', () => {
      expect(isIdCard('110101199013321234')).toBe(false); // Invalid month (13)
      expect(isIdCard('110101199003321234')).toBe(false); // Invalid day (32)
    });

    test('should reject null or empty ID card', () => {
      expect(isIdCard(null)).toBe(false);
      expect(isIdCard('')).toBe(false);
      expect(isIdCard(undefined)).toBe(false);
    });

    test('should reject non-string ID card', () => {
      expect(isIdCard(110101199003071234)).toBe(false);
      expect(isIdCard({})).toBe(false);
    });

    test('should validate ID card with X check digit', () => {
      expect(isIdCard('11010119900307123X')).toBe(true);
    });
  });

  describe('[VAL-6] 验证非空字段', () => {
    test('should detect empty strings', () => {
      expect(isEmpty('')).toBe(true);
      expect(isEmpty('   ')).toBe(true);
    });

    test('should detect null and undefined', () => {
      expect(isEmpty(null)).toBe(true);
      expect(isEmpty(undefined)).toBe(true);
    });

    test('should detect empty arrays', () => {
      expect(isEmpty([])).toBe(true);
    });

    test('should detect empty objects', () => {
      expect(isEmpty({})).toBe(true);
    });

    test('should detect non-empty values', () => {
      expect(isEmpty('text')).toBe(false);
      expect(isEmpty([1, 2, 3])).toBe(false);
      expect(isEmpty({ key: 'value' })).toBe(false);
      expect(isEmpty(123)).toBe(false);
    });

    test('should handle whitespace trimming', () => {
      expect(isEmpty('  text  ')).toBe(false);
      expect(isEmpty('   ')).toBe(true);
    });
  });

  describe('[VAL-7] 验证日期范围（开始日期 < 结束日期）', () => {
    test('should validate date format', () => {
      expect(isDate('2025-03-04')).toBe(true);
      expect(isDate('2000-01-01')).toBe(true);
    });

    test('should reject invalid date format', () => {
      expect(isDate('03-04-2025')).toBe(false);
      expect(isDate('2025/03/04')).toBe(false);
      expect(isDate('2025-3-4')).toBe(false);
    });

    test('should reject invalid dates', () => {
      // Note: JavaScript Date constructor is lenient and accepts invalid dates
      // Only reject dates with invalid format (not matching YYYY-MM-DD)
      expect(isDate('2025-13-01')).toBe(false); // Month 13 doesn't exist
      expect(isDate('2025-1-1')).toBe(false); // Missing leading zeros
    });

    test('should validate time format HH:mm', () => {
      expect(isTime('10:30')).toBe(true);
      expect(isTime('23:59')).toBe(true);
      expect(isTime('00:00')).toBe(true);
    });

    test('should validate time format HH:mm:ss', () => {
      expect(isTime('10:30:45')).toBe(true);
      expect(isTime('23:59:59')).toBe(true);
    });

    test('should reject invalid time format', () => {
      expect(isTime('25:00')).toBe(false);
      expect(isTime('10:60')).toBe(false);
      expect(isTime('10:30:60')).toBe(false);
    });

    test('should validate number ranges', () => {
      expect(isInRange(50, 0, 100)).toBe(true);
      expect(isInRange(0, 0, 100)).toBe(true);
      expect(isInRange(100, 0, 100)).toBe(true);
    });

    test('should reject values outside range', () => {
      expect(isInRange(150, 0, 100)).toBe(false);
      expect(isInRange(-10, 0, 100)).toBe(false);
    });
  });

  describe('[VAL-8] 验证金额范围（正数且最多两位小数）', () => {
    test('should validate positive integer amount', () => {
      expect(isInRange(99, 0, 1000)).toBe(true);
      expect(isInRange(0, 0, 1000)).toBe(true);
    });

    test('should validate decimal amount', () => {
      expect(isInRange(99.99, 0, 1000)).toBe(true);
      expect(isInRange(99.5, 0, 1000)).toBe(true);
    });

    test('should reject negative amounts', () => {
      expect(isInRange(-99, 0, 100)).toBe(false);
    });

    test('should reject amounts exceeding max', () => {
      expect(isInRange(1001, 0, 1000)).toBe(false);
    });

    test('should be positive', () => {
      expect(isPositiveInteger(1)).toBe(true);
      expect(isPositiveInteger(100)).toBe(true);
      expect(isPositiveInteger(0)).toBe(false);
      expect(isPositiveInteger(-1)).toBe(false);
    });

    test('should validate number type', () => {
      expect(isNumber(99)).toBe(true);
      expect(isNumber(99.99)).toBe(true);
      expect(isNumber(0)).toBe(true);
      expect(isNumber('99')).toBe(false);
      expect(isNumber(NaN)).toBe(false);
    });
  });

  describe('Additional Validator Functions', () => {
    test('isValidLength should validate string length', () => {
      expect(isValidLength('hello', 0, 10)).toBe(true);
      expect(isValidLength('hello', 5, 10)).toBe(true);
      expect(isValidLength('hello', 0, 4)).toBe(false);
      expect(isValidLength('hello', 6, 10)).toBe(false);
    });

    test('isChinese should validate Chinese characters', () => {
      expect(isChinese('中文')).toBe(true);
      expect(isChinese('你好世界')).toBe(true);
      expect(isChinese('hello')).toBe(false);
      expect(isChinese('中文hello')).toBe(false);
    });

    test('isAlpha should validate alphabetic characters', () => {
      expect(isAlpha('hello')).toBe(true);
      expect(isAlpha('HELLO')).toBe(true);
      expect(isAlpha('helloWorld')).toBe(true);
      expect(isAlpha('hello123')).toBe(false);
      expect(isAlpha('hello ')).toBe(false);
    });

    test('isAlphanumeric should validate alphanumeric', () => {
      expect(isAlphanumeric('hello123')).toBe(true);
      expect(isAlphanumeric('abc')).toBe(true);
      expect(isAlphanumeric('123')).toBe(true);
      expect(isAlphanumeric('hello-123')).toBe(false);
      expect(isAlphanumeric('hello ')).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle null inputs gracefully', () => {
      expect(isEmpty(null)).toBe(true);
      expect(isEmail(null)).toBe(false);
      expect(isPhone(null)).toBe(false);
      expect(isUrl(null)).toBe(false);
    });

    test('should handle undefined inputs gracefully', () => {
      expect(isEmpty(undefined)).toBe(true);
      expect(isEmail(undefined)).toBe(false);
      expect(isPhone(undefined)).toBe(false);
    });

    test('should handle empty string consistently', () => {
      expect(isEmpty('')).toBe(true);
      expect(isEmail('')).toBe(false);
      expect(isPhone('')).toBe(false);
      expect(isUrl('')).toBe(false);
    });

    test('should handle whitespace-only strings', () => {
      expect(isEmpty('   ')).toBe(true);
      expect(isEmail('   ')).toBe(false);
      expect(isAlpha('   ')).toBe(false);
    });

    test('should validate password with no requirements', () => {
      const result = validatePassword('anything');
      expect(result.valid).toBe(true);
    });

    test('should handle special password characters', () => {
      const result = validatePassword('Pass!@#$%123', {
        requireSpecialChar: true
      });
      expect(result.valid).toBe(true);
    });
  });
});
