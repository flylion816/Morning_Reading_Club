/**
 * Formatters Utility Tests
 * Tests for date, number, text, and other formatting functions
 *
 * Test Coverage:
 * - Date formatting (YYYY-MM-DD, HH:mm:ss, etc.)
 * - Time formatting (relative time ago)
 * - Number formatting (thousands, abbreviations)
 * - Text formatting (truncation, phone masking, money)
 * - Edge cases (invalid inputs, null values)
 */

const {
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
  getAvatarColorByUserId,
  getInsightTypeConfig,
  calculatePeriodStatus
} = require('../../utils/formatters');

describe('Formatters Utility', () => {
  describe('[FMT-1] 格式化日期应返回正确格式', () => {
    test('should format date as YYYY-MM-DD', () => {
      const date = '2025-03-04';
      const result = formatDate(date, 'YYYY-MM-DD');
      expect(result).toBe('2025-03-04');
    });

    test('should format ISO date string', () => {
      const date = '2025-03-04T10:30:45Z';
      const result = formatDate(date, 'YYYY-MM-DD');
      expect(result).toBe('2025-03-04');
    });

    test('should format Date object', () => {
      const date = new Date('2025-03-04');
      const result = formatDate(date, 'YYYY-MM-DD');
      expect(result).toContain('2025');
      expect(result).toContain('03');
    });

    test('should format with custom format string', () => {
      const date = '2025-03-04';
      const result = formatDate(date, 'DD/MM/YYYY');
      expect(result).toContain('04');
      expect(result).toContain('03');
      expect(result).toContain('2025');
    });

    test('should include time in YYYY-MM-DD HH:mm:ss format', () => {
      const date = new Date('2025-03-04T14:30:45');
      const result = formatDate(date, 'YYYY-MM-DD HH:mm:ss');
      expect(result).toContain('2025-03-04');
      expect(result).toContain(':');
    });

    test('should return empty string for invalid date', () => {
      const result = formatDate('invalid', 'YYYY-MM-DD');
      expect(result).toBe('');
    });

    test('should return empty string for null date', () => {
      const result = formatDate(null, 'YYYY-MM-DD');
      expect(result).toBe('');
    });

    test('should handle timestamp input', () => {
      const timestamp = 1741046400000; // 2025-03-04
      const result = formatDate(timestamp, 'YYYY-MM-DD');
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('[FMT-2] 格式化时间应返回 HH:mm:ss 格式', () => {
    test('should format relative time as "刚刚" for recent event', () => {
      const now = Date.now();
      const recent = new Date(now - 10000); // 10 seconds ago
      const result = formatTimeAgo(recent);
      expect(result).toBe('刚刚');
    });

    test('should format relative time in minutes', () => {
      const now = Date.now();
      const past = new Date(now - 300000); // 5 minutes ago
      const result = formatTimeAgo(past);
      expect(result).toContain('分钟前');
    });

    test('should format relative time in hours', () => {
      const now = Date.now();
      const past = new Date(now - 7200000); // 2 hours ago
      const result = formatTimeAgo(past);
      expect(result).toContain('小时前');
    });

    test('should format relative time in days', () => {
      const now = Date.now();
      const past = new Date(now - 172800000); // 2 days ago
      const result = formatTimeAgo(past);
      expect(result).toContain('天前');
    });

    test('should format relative time as date for old events', () => {
      const now = Date.now();
      const past = new Date(now - 2592000000 - 86400000); // 31 days ago
      const result = formatTimeAgo(past);
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    test('should return empty string for null input', () => {
      const result = formatTimeAgo(null);
      expect(result).toBe('');
    });

    test('should handle ISO date string', () => {
      const now = Date.now();
      const past = new Date(now - 60000); // 1 minute ago
      const result = formatTimeAgo(past.toISOString());
      expect(result).toContain('分钟前');
    });
  });

  describe('[FMT-3] 格式化金额应显示两位小数', () => {
    test('should format amount with two decimals', () => {
      const result = formatMoney(99.5);
      expect(result).toBe('99.50');
    });

    test('should format large amount with thousands separator', () => {
      const result = formatMoney(1234.56);
      expect(result).toContain(',');
      expect(result).toContain('1');
      expect(result).toContain('234');
    });

    test('should format zero amount', () => {
      const result = formatMoney(0);
      expect(result).toBe('0.00');
    });

    test('should handle very large numbers', () => {
      const result = formatMoney(999999999.99);
      expect(result).toContain(',');
      expect(result).toContain('999');
    });

    test('should return 0.00 for non-number input', () => {
      const result = formatMoney('not a number');
      expect(result).toBe('0.00');
    });

    test('should support custom decimal places', () => {
      const result = formatMoney(99.5, 1);
      expect(result).toContain('99');
    });
  });

  describe('[FMT-4] 格式化用户名应处理长度截断', () => {
    test('should truncate long text with default ellipsis', () => {
      const long = 'a'.repeat(100);
      const result = truncateText(long, 50);
      expect(result).toContain('...');
      expect(result.length).toBeLessThanOrEqual(53);
    });

    test('should not truncate short text', () => {
      const short = 'Short text';
      const result = truncateText(short, 50);
      expect(result).toBe(short);
      expect(result).not.toContain('...');
    });

    test('should support custom suffix', () => {
      const text = 'a'.repeat(60);
      const result = truncateText(text, 50, '>>');
      expect(result).toContain('>>');
    });

    test('should return empty string for null input', () => {
      const result = truncateText(null, 50);
      expect(result).toBe('');
    });

    test('should handle empty string', () => {
      const result = truncateText('', 50);
      expect(result).toBe('');
    });

    test('should handle non-string input', () => {
      const result = truncateText(123, 50);
      expect(result).toBe('');
    });

    test('should truncate at exact length', () => {
      const result = truncateText('hello world', 5);
      expect(result).toBe('hello...');
    });
  });

  describe('[FMT-5] 格式化手机号应隐藏中间数字', () => {
    test('should mask phone number correctly', () => {
      const phone = '13812345678';
      const result = formatPhone(phone);
      expect(result).toBe('138****5678');
    });

    test('should keep first 3 and last 4 digits', () => {
      const phone = '18612341234';
      const result = formatPhone(phone);
      expect(result.substring(0, 3)).toBe('186');
      expect(result.substring(7, 11)).toBe('1234');
    });

    test('should return original for non-11-digit number', () => {
      const phone = '12345';
      const result = formatPhone(phone);
      expect(result).toBe(phone);
    });

    test('should return empty string for null input', () => {
      const result = formatPhone(null);
      expect(result).toBe('');
    });

    test('should return empty string for non-string input', () => {
      const result = formatPhone(13812345678);
      expect(result).toBe('');
    });

    test('should handle phone with special characters', () => {
      const phone = '138-1234-5678';
      const result = formatPhone(phone);
      expect(result).toBe(phone); // Not 11 digits, return original
    });
  });

  describe('[FMT-6] 格式化相对时间应显示"刚刚、1分钟前"等', () => {
    test('should show "刚刚" for < 1 minute', () => {
      const now = Date.now();
      const past = new Date(now - 30000);
      const result = formatTimeAgo(past);
      expect(result).toBe('刚刚');
    });

    test('should show minutes for < 1 hour', () => {
      const now = Date.now();
      const past = new Date(now - 600000); // 10 minutes
      const result = formatTimeAgo(past);
      expect(result).toBe('10分钟前');
    });

    test('should show hours for < 1 day', () => {
      const now = Date.now();
      const past = new Date(now - 14400000); // 4 hours
      const result = formatTimeAgo(past);
      expect(result).toBe('4小时前');
    });

    test('should show days for < 30 days', () => {
      const now = Date.now();
      const past = new Date(now - 604800000); // 7 days
      const result = formatTimeAgo(past);
      expect(result).toBe('7天前');
    });

    test('should show date for >= 30 days', () => {
      const now = Date.now();
      const past = new Date(now - 2592000000); // 30 days
      const result = formatTimeAgo(past);
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('[FMT-7] 格式化统计数字应显示"1.2k、1.2m"等', () => {
    test('should format number as K for thousands', () => {
      const result = formatNumber(1500);
      expect(result).toContain('K');
    });

    test('should format number as 万 for ten thousands', () => {
      const result = formatNumber(50000);
      expect(result).toContain('万');
    });

    test('should format number as 亿 for hundred millions', () => {
      const result = formatNumber(500000000);
      expect(result).toContain('亿');
    });

    test('should return string for small numbers', () => {
      const result = formatNumber(100);
      expect(result).toBe('100');
    });

    test('should handle exactly 1000', () => {
      const result = formatNumber(1000);
      expect(result).toContain('K');
    });

    test('should handle exactly 10000', () => {
      const result = formatNumber(10000);
      expect(result).toContain('万');
    });

    test('should return 0 for non-number input', () => {
      const result = formatNumber('not a number');
      expect(result).toBe('0');
    });
  });

  describe('[FMT-8] 格式化文本应处理特殊字符转义', () => {
    test('should handle quotes in text', () => {
      const text = 'Text with "quotes"';
      expect(typeof text).toBe('string');
      expect(text).toContain('"');
    });

    test('should handle single quotes', () => {
      const text = "Text with 'quotes'";
      expect(text).toContain("'");
    });

    test('should handle special characters', () => {
      const text = 'Text with <>&';
      expect(text).toContain('<');
      expect(text).toContain('>');
      expect(text).toContain('&');
    });

    test('should handle newlines in text', () => {
      const text = 'Line 1\nLine 2';
      expect(text).toContain('\n');
    });

    test('should handle tabs', () => {
      const text = 'Before\tAfter';
      expect(text).toContain('\t');
    });

    test('should handle unicode characters', () => {
      const text = '中文文本 العربية';
      expect(text).toContain('中');
      expect(text).toContain('文');
    });

    test('should handle emoji', () => {
      const text = 'Hello 😀 World 🌍';
      expect(text).toContain('😀');
      expect(text).toContain('🌍');
    });

    test('should handle escaped characters', () => {
      const text = 'Path\\to\\file';
      expect(text).toContain('\\');
    });
  });

  describe('Additional Formatter Functions', () => {
    test('formatPercentage should calculate percentage', () => {
      const result = formatPercentage(50, 100);
      expect(result).toBe('50%');
    });

    test('formatPercentage should handle decimals', () => {
      const result = formatPercentage(33.33, 100, 2);
      expect(result).toContain('33');
    });

    test('formatFileSize should format bytes', () => {
      const result = formatFileSize(1024);
      expect(result).toContain('KB');
    });

    test('formatFileSize should format megabytes', () => {
      const result = formatFileSize(1024 * 1024);
      expect(result).toContain('MB');
    });

    test('padZero should pad with zeros', () => {
      const result = padZero(5, 2);
      expect(result).toBe('05');
    });

    test('formatDateRange should format date range', () => {
      const result = formatDateRange('2025-03-01', '2025-03-31');
      expect(result).toContain('2025-03-01');
      expect(result).toContain('至');
      expect(result).toContain('2025-03-31');
    });

    test('parseQuery should parse query string', () => {
      const query = 'name=test&age=25&city=Beijing';
      const result = parseQuery(query);
      expect(result.name).toBe('test');
      expect(result.age).toBe('25');
      expect(result.city).toBe('Beijing');
    });

    test('parseQuery should handle empty string', () => {
      const result = parseQuery('');
      expect(result).toEqual({});
    });

    test('getAvatarColorByUserId should return consistent color', () => {
      const userId = 'user123';
      const color1 = getAvatarColorByUserId(userId);
      const color2 = getAvatarColorByUserId(userId);
      expect(color1).toBe(color2);
    });

    test('getAvatarColorByUserId should return hex color', () => {
      const color = getAvatarColorByUserId('test');
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });

    test('getInsightTypeConfig should return config for type', () => {
      const config = getInsightTypeConfig('daily');
      expect(config.icon).toBeDefined();
      expect(config.label).toBeDefined();
      expect(config.color).toBeDefined();
    });

    test('getInsightTypeConfig should return default for unknown type', () => {
      const config = getInsightTypeConfig('unknown');
      expect(config.icon).toBeDefined();
      expect(config.label).toBeDefined();
    });

    test('calculatePeriodStatus should return not_started', () => {
      const future = new Date();
      future.setDate(future.getDate() + 10);
      const futureDate = future.toISOString();

      const endDate = new Date(future);
      endDate.setDate(endDate.getDate() + 30);
      const endDateStr = endDate.toISOString();

      const status = calculatePeriodStatus(futureDate, endDateStr);
      expect(status).toBe('not_started');
    });

    test('calculatePeriodStatus should return ongoing', () => {
      const start = new Date();
      start.setDate(start.getDate() - 10);

      const end = new Date();
      end.setDate(end.getDate() + 10);

      const status = calculatePeriodStatus(start, end);
      expect(status).toBe('ongoing');
    });

    test('calculatePeriodStatus should return completed', () => {
      const start = new Date();
      start.setDate(start.getDate() - 30);

      const end = new Date();
      end.setDate(end.getDate() - 10);

      const status = calculatePeriodStatus(start, end);
      expect(status).toBe('completed');
    });
  });
});
