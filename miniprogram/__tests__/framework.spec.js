/**
 * Framework Test
 * Verifies that the testing framework is properly configured
 */

const fixtures = require('./fixtures');
const WxMock = require('./mocks/wx');

describe('Testing Framework Verification', () => {
  describe('Fixtures', () => {
    test('should have all factory functions exported', () => {
      expect(typeof fixtures.generateId).toBe('function');
      expect(typeof fixtures.createMockUser).toBe('function');
      expect(typeof fixtures.createMockPeriod).toBe('function');
      expect(typeof fixtures.createMockCourse).toBe('function');
      expect(typeof fixtures.createMockEnrollment).toBe('function');
      expect(typeof fixtures.createMockCheckin).toBe('function');
      expect(typeof fixtures.createMockInsight).toBe('function');
      expect(typeof fixtures.createMockPayment).toBe('function');
      expect(typeof fixtures.createMockRankingItem).toBe('function');
      expect(typeof fixtures.createMockComment).toBe('function');
    });

    test('createMockUser should generate user with required fields', () => {
      const user = fixtures.createMockUser();
      expect(user._id).toBeDefined();
      expect(user.openid).toBeDefined();
      expect(user.nickname).toBeDefined();
      expect(user.avatar).toBeDefined();
      expect(user.status).toBe('active');
    });

    test('createMockUser should support field overrides', () => {
      const user = fixtures.createMockUser({ nickname: '自定义用户' });
      expect(user.nickname).toBe('自定义用户');
      expect(user._id).toBeDefined(); // Other fields should still be generated
    });

    test('createMockPeriod should generate period with required fields', () => {
      const period = fixtures.createMockPeriod();
      expect(period._id).toBeDefined();
      expect(period.name).toBeDefined();
      expect(period.status).toBe('active');
      expect(period.price).toBeDefined();
    });

    test('createMockCourse should generate course with required fields', () => {
      const course = fixtures.createMockCourse();
      expect(course._id).toBeDefined();
      expect(course.periodId).toBeDefined();
      expect(course.title).toBeDefined();
      expect(course.status).toBe('published');
    });

    test('createMockEnrollment should generate enrollment with required fields', () => {
      const enrollment = fixtures.createMockEnrollment();
      expect(enrollment._id).toBeDefined();
      expect(enrollment.userId).toBeDefined();
      expect(enrollment.periodId).toBeDefined();
      expect(enrollment.status).toBe('active');
    });

    test('createMockCheckin should generate checkin with required fields', () => {
      const checkin = fixtures.createMockCheckin();
      expect(checkin._id).toBeDefined();
      expect(checkin.userId).toBeDefined();
      expect(checkin.periodId).toBeDefined();
      expect(checkin.status).toBe('completed');
    });

    test('createMockInsight should generate insight with required fields', () => {
      const insight = fixtures.createMockInsight();
      expect(insight._id).toBeDefined();
      expect(insight.creatorUserId).toBeDefined();
      expect(insight.targetUserId).toBeDefined();
      expect(insight.periodId).toBeDefined();
      expect(insight.status).toBe('published');
    });

    test('createMockPayment should generate payment with required fields', () => {
      const payment = fixtures.createMockPayment();
      expect(payment._id).toBeDefined();
      expect(payment.userId).toBeDefined();
      expect(payment.periodId).toBeDefined();
      expect(payment.status).toBe('completed');
    });

    test('createMockRankingItem should generate ranking with required fields', () => {
      const ranking = fixtures.createMockRankingItem();
      expect(ranking._id).toBeDefined();
      expect(ranking.userId).toBeDefined();
      expect(ranking.periodId).toBeDefined();
      expect(ranking.rank).toBeDefined();
    });

    test('createMockComment should generate comment with required fields', () => {
      const comment = fixtures.createMockComment();
      expect(comment._id).toBeDefined();
      expect(comment.insightId).toBeDefined();
      expect(comment.userId).toBeDefined();
      expect(comment.status).toBe('published');
    });
  });

  describe('WxMock Class', () => {
    let wxMock;

    beforeEach(() => {
      wxMock = new WxMock();
    });

    test('should instantiate WxMock', () => {
      expect(wxMock).toBeDefined();
      expect(typeof wxMock.getStorageSync).toBe('function');
    });

    test('storage should work', () => {
      wxMock.setStorageSync('test_key', { data: 'test' });
      const value = wxMock.getStorageSync('test_key');
      expect(value).toEqual({ data: 'test' });
    });

    test('removeStorageSync should remove items', () => {
      wxMock.setStorageSync('test_key', { data: 'test' });
      wxMock.removeStorageSync('test_key');
      const value = wxMock.getStorageSync('test_key');
      expect(value).toBeNull();
    });

    test('clearStorageSync should clear all storage', () => {
      wxMock.setStorageSync('key1', 'value1');
      wxMock.setStorageSync('key2', 'value2');
      wxMock.clearStorageSync();
      expect(wxMock.getStorageSync('key1')).toBeNull();
      expect(wxMock.getStorageSync('key2')).toBeNull();
    });

    test('request should call success callback', (done) => {
      const mockResponse = { code: 200, data: 'test' };
      wxMock.request({
        url: '/api/test',
        success: (res) => {
          expect(res.statusCode).toBe(200);
          done();
        },
        _mockResponse: mockResponse,
      });
    });

    test('login should return mock code', (done) => {
      wxMock.login({
        success: (res) => {
          expect(res.code).toBeDefined();
          expect(res.code.startsWith('mock_code_')).toBe(true);
          done();
        },
      });
    });

    test('getSystemInfoSync should return system info', () => {
      const info = wxMock.getSystemInfoSync();
      expect(info.platform).toBeDefined();
      expect(info.version).toBeDefined();
      expect(info.screenWidth).toBeDefined();
    });

    test('showModal should call success callback', (done) => {
      wxMock.showModal({
        title: '测试',
        content: '测试内容',
        success: (res) => {
          expect(res.confirm).toBe(true);
          done();
        },
      });
    });

    test('reset should clear all state', () => {
      wxMock.setStorageSync('test_key', 'value');
      wxMock.reset();
      expect(wxMock.getStorageSync('test_key')).toBeNull();
    });
  });

  describe('Global wx object', () => {
    test('global wx should be available', () => {
      expect(global.wx).toBeDefined();
    });

    test('global wx should have all required methods', () => {
      expect(typeof global.wx.getStorageSync).toBe('function');
      expect(typeof global.wx.setStorageSync).toBe('function');
      expect(typeof global.wx.request).toBe('function');
      expect(typeof global.wx.login).toBe('function');
      expect(typeof global.wx.requestPayment).toBe('function');
      expect(typeof global.wx.navigateTo).toBe('function');
    });
  });

  describe('Global console mocks', () => {
    test('console methods should be mocked', () => {
      expect(typeof console.log.mock).toBe('object');
      expect(typeof console.error.mock).toBe('object');
      expect(typeof console.warn.mock).toBe('object');
    });
  });

  describe('ID generation', () => {
    test('should generate unique IDs with counter', () => {
      const id1 = fixtures.generateId();
      const id2 = fixtures.generateId();
      const id3 = fixtures.generateId();
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    test('generated IDs should be non-empty strings', () => {
      const id = fixtures.generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('WxMock - Error Path Tests', () => {
    let wxMock;

    beforeEach(() => {
      wxMock = new WxMock();
    });

    test('requestPayment should respect _successRate parameter', (done) => {
      wxMock.setPaymentDelay(10);
      let successCalled = false;

      wxMock.requestPayment({
        _successRate: 1,  // Guarantee success
        success: () => {
          successCalled = true;
        },
        fail: () => {
          // Should not be called when _successRate = 1
          expect(false).toBe(true);
        }
      });

      setTimeout(() => {
        expect(successCalled).toBe(true);
        done();
      }, 50);
    });

    test('requestPayment should call success callback with custom mock response', (done) => {
      wxMock.setPaymentDelay(10);
      const customResponse = { errMsg: 'requestPayment:ok', transactionId: 'custom_txn_123' };

      wxMock.requestPayment({
        _successRate: 1,  // Force success
        _mockResponse: customResponse,
        success: (response) => {
          expect(response).toEqual(customResponse);
          done();
        }
      });
    });

    test('request should call success callback with correct structure', (done) => {
      wxMock.setRequestDelay(10);

      wxMock.request({
        url: 'http://test.com',
        _mockResponse: { code: 200, message: 'OK' },
        success: (response) => {
          expect(response.statusCode).toBe(200);
          expect(response.data.code).toBe(200);
          expect(response.data.message).toBe('OK');
          done();
        }
      });
    });

    test('factory functions should accept empty overrides', () => {
      // Valid: empty override object
      const user = fixtures.createMockUser({});
      expect(user._id).toBeDefined();
      expect(user.nickname).toBeDefined();
      expect(user.status).toBe('active');
    });

    test('factory functions should accept partial overrides', () => {
      // Valid: partial override
      const user = fixtures.createMockUser({ nickname: 'Custom User', status: 'inactive' });
      expect(user.nickname).toBe('Custom User');
      expect(user.status).toBe('inactive');
      expect(user._id).toBeDefined();  // Other fields should still be generated
    });

    test('multiple mock users should have different IDs', () => {
      const user1 = fixtures.createMockUser();
      const user2 = fixtures.createMockUser();
      const user3 = fixtures.createMockUser();

      expect(user1._id).not.toBe(user2._id);
      expect(user2._id).not.toBe(user3._id);
      expect(user1._id).not.toBe(user3._id);
    });

    test('should generate valid insight objects with all required fields', () => {
      const insight = fixtures.createMockInsight();
      expect(insight._id).toBeDefined();
      expect(insight.creatorUserId).toBeDefined();
      expect(insight.targetUserId).toBeDefined();
      expect(insight.periodId).toBeDefined();
      expect(insight.title).toBeDefined();
      expect(insight.status).toBe('published');
    });
  });
});
