/**
 * Ranking Controller 单元测试
 */

// Mock dependencies before requiring the controller
jest.mock('../../../src/models/Checkin');
jest.mock('../../../src/models/User');
jest.mock('../../../src/models/Period');

jest.mock('../../../src/utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../../src/utils/response', () => ({
  success: (data, message) => ({ code: 200, message, data }),
  errors: {
    badRequest: (msg) => ({ code: 400, message: msg }),
    notFound: (msg) => ({ code: 404, message: msg }),
    forbidden: (msg) => ({ code: 403, message: msg }),
    internalServerError: (msg) => ({ code: 500, message: msg })
  }
}));

const mongoose = require('mongoose');
const { getPeriodRanking } = require('../../../src/controllers/ranking.controller');
const Checkin = require('../../../src/models/Checkin');
const User = require('../../../src/models/User');
const Period = require('../../../src/models/Period');

describe('Ranking Controller', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      params: { periodId: new mongoose.Types.ObjectId().toString() },
      query: { page: 1, limit: 10 },
      user: { userId: new mongoose.Types.ObjectId().toString() }
    };

    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis()
    };

    next = jest.fn();

    jest.clearAllMocks();
  });

  describe('getPeriodRanking', () => {
    it('应该返回期次排行榜列表', async () => {
      const periodId = req.params.periodId;
      const userId = req.user.userId;
      const userObjId = new mongoose.Types.ObjectId(userId);

      // Mock Period.findById
      Period.findById = jest.fn().mockResolvedValue({
        _id: periodId,
        name: '第一期',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      // Mock Checkin.aggregate
      const mockAggregateResult = [
        {
          _id: userObjId,
          checkinCount: 25,
          lastCheckinDate: new Date('2025-01-20'),
          userInfo: {
            _id: userObjId,
            nickname: '用户1',
            avatar: 'avatar1.jpg',
            avatarUrl: 'https://example.com/avatar1.jpg'
          }
        },
        {
          _id: new mongoose.Types.ObjectId(),
          checkinCount: 20,
          lastCheckinDate: new Date('2025-01-19'),
          userInfo: {
            _id: new mongoose.Types.ObjectId(),
            nickname: '用户2',
            avatar: 'avatar2.jpg',
            avatarUrl: 'https://example.com/avatar2.jpg'
          }
        }
      ];

      Checkin.aggregate = jest.fn().mockResolvedValue(mockAggregateResult);

      // Mock User.findById for current user with chainable select
      const mockUserData = {
        _id: userObjId,
        nickname: '用户1',
        avatar: 'avatar1.jpg',
        avatarUrl: 'https://example.com/avatar1.jpg'
      };

      User.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUserData)
      });

      await getPeriodRanking(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.code).toBe(200);
      expect(responseData.data).toHaveProperty('list');
      expect(responseData.data).toHaveProperty('currentUser');
      expect(responseData.data).toHaveProperty('total');
    });

    it('应该支持时间范围过滤 - today', async () => {
      req.query.timeRange = 'today';

      Period.findById = jest.fn().mockResolvedValue({ _id: req.params.periodId });

      const mockResult = [
        {
          _id: new mongoose.Types.ObjectId(),
          checkinCount: 5,
          lastCheckinDate: new Date(),
          userInfo: { _id: new mongoose.Types.ObjectId(), nickname: '用户1', avatar: '' }
        }
      ];

      Checkin.aggregate = jest.fn().mockResolvedValue(mockResult);
      User.findById = jest.fn().mockResolvedValue({
        _id: req.user.userId,
        nickname: '用户',
        avatar: ''
      });

      await getPeriodRanking(req, res, next);

      expect(res.json).toHaveBeenCalled();
      expect(Checkin.aggregate).toHaveBeenCalled();
    });

    it('应该支持时间范围过滤 - thisWeek', async () => {
      req.query.timeRange = 'thisWeek';

      Period.findById = jest.fn().mockResolvedValue({ _id: req.params.periodId });

      const mockResult = [
        {
          _id: new mongoose.Types.ObjectId(),
          checkinCount: 10,
          lastCheckinDate: new Date(),
          userInfo: { _id: new mongoose.Types.ObjectId(), nickname: '用户1', avatar: '' }
        }
      ];

      Checkin.aggregate = jest.fn().mockResolvedValue(mockResult);
      User.findById = jest.fn().mockResolvedValue({
        _id: req.user.userId,
        nickname: '用户',
        avatar: ''
      });

      await getPeriodRanking(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('应该支持分页', async () => {
      req.query = { page: 2, limit: 5, timeRange: 'all' };

      Period.findById = jest.fn().mockResolvedValue({ _id: req.params.periodId });

      const mockResult = Array.from({ length: 5 }, (_, i) => ({
        _id: new mongoose.Types.ObjectId(),
        checkinCount: 10 - i,
        lastCheckinDate: new Date(),
        userInfo: { _id: new mongoose.Types.ObjectId(), nickname: `用户${i}`, avatar: '' }
      }));

      Checkin.aggregate = jest.fn().mockResolvedValue(mockResult);
      User.findById = jest.fn().mockResolvedValue({
        _id: req.user.userId,
        nickname: '用户',
        avatar: ''
      });

      await getPeriodRanking(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.data.page).toBe(2);
      expect(responseData.data.limit).toBe(5);
    });

    it('应该返回404当期次不存在', async () => {
      Period.findById = jest.fn().mockResolvedValue(null);

      await getPeriodRanking(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalled();
    });

    it('应该在出错时调用next传递错误', async () => {
      const testError = new Error('Database error');

      Period.findById = jest.fn().mockRejectedValue(testError);

      await getPeriodRanking(req, res, next);

      expect(next).toHaveBeenCalledWith(testError);
    });
  });
});
