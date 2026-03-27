const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

describe('Insight Request Flow Integration - 单条授权回归', () => {
  let app;
  let store;
  let controller;
  let publishSyncEvents;

  const ownerToken = 'owner-token';
  const requesterToken = 'requester-token';

  function createId() {
    return new mongoose.Types.ObjectId().toString();
  }

  function clone(value) {
    return structuredClone(value);
  }

  function toComparable(value) {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'object' && !Array.isArray(value) && '$ne' in value) {
      return value;
    }

    if (typeof value === 'object' && value._id) {
      return value._id.toString();
    }

    return value.toString ? value.toString() : value;
  }

  function matchesQuery(doc, query) {
    if (!query || Object.keys(query).length === 0) {
      return true;
    }

    if (query.$or) {
      return query.$or.some(condition => matchesQuery(doc, condition));
    }

    return Object.entries(query).every(([key, expected]) => {
      const actual = doc[key];

      if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
        if ('$ne' in expected) {
          return toComparable(actual) !== expected.$ne;
        }
      }

      return toComparable(actual) === toComparable(expected);
    });
  }

  function selectFields(doc, fields) {
    if (!fields) {
      return doc;
    }

    const keys = fields.split(/\s+/).filter(Boolean);
    const selected = {};

    keys.forEach(key => {
      if (doc[key] !== undefined) {
        selected[key] = doc[key];
      }
    });

    if (doc._id !== undefined) {
      selected._id = doc._id;
    }

    return selected;
  }

  function attachInsightMethods(doc) {
    doc.toObject = () => clone({
      _id: doc._id,
      userId: doc.userId,
      targetUserId: doc.targetUserId,
      periodId: doc.periodId,
      sectionId: doc.sectionId,
      title: doc.title,
      periodName: doc.periodName,
      day: doc.day,
      type: doc.type,
      mediaType: doc.mediaType,
      content: doc.content,
      summary: doc.summary,
      imageUrl: doc.imageUrl || null,
      status: doc.status,
      isPublished: doc.isPublished,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });

    return doc;
  }

  function attachRequestMethods(doc) {
    doc.toObject = () => clone({
      _id: doc._id,
      fromUserId: doc.fromUserId,
      toUserId: doc.toUserId,
      periodId: doc.periodId,
      insightId: doc.insightId,
      status: doc.status,
      requestPeriodName: doc.requestPeriodName,
      requestInsightTitle: doc.requestInsightTitle,
      requestInsightDay: doc.requestInsightDay,
      approvedAt: doc.approvedAt,
      rejectedAt: doc.rejectedAt,
      revokedAt: doc.revokedAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });
    doc.save = async () => {
      doc.updatedAt = new Date();
      const index = store.requests.findIndex(item => item._id === doc._id);
      store.requests[index] = clone(doc);
      return doc;
    };

    return doc;
  }

  function populateInsightDoc(doc, populateSteps) {
    let result = attachInsightMethods(clone(doc));

    populateSteps.forEach(step => {
      if (typeof step === 'string') {
        return;
      }

      const path = typeof step === 'string' ? step : step.path;
      const select = typeof step === 'string' ? undefined : step.select;

      if (path === 'userId' || path === 'targetUserId') {
        const user = store.users.find(item => item._id === result[path]);
        result[path] = user ? selectFields(clone(user), select) : null;
      }

      if (path === 'periodId') {
        const periodId = typeof result.periodId === 'object' ? result.periodId._id : result.periodId;
        const period = store.periods.find(item => item._id === periodId);
        result.periodId = period ? selectFields(clone(period), select) : null;
      }

      if (path === 'sectionId') {
        const sectionId = typeof result.sectionId === 'object' ? result.sectionId._id : result.sectionId;
        const section = store.sections.find(item => item._id === sectionId);
        result.sectionId = section ? selectFields(clone(section), select) : null;
      }
    });

    return result;
  }

  function populateRequestDoc(doc, populateSteps) {
    let result = attachRequestMethods(clone(doc));

    populateSteps.forEach(step => {
      const path = typeof step === 'string' ? step : step.path;
      const select = typeof step === 'string' ? undefined : step.select;

      if (path === 'fromUserId' || path === 'toUserId') {
        const user = store.users.find(item => item._id === result[path]);
        result[path] = user ? selectFields(clone(user), select) : null;
      }

      if (path === 'periodId') {
        const period = store.periods.find(item => item._id === result.periodId);
        result.periodId = period ? selectFields(clone(period), select) : null;
      }

      if (path === 'insightId') {
        const insight = store.insights.find(item => item._id === result.insightId);
        if (!insight) {
          result.insightId = null;
          return;
        }

        let populatedInsight = selectFields(clone(insight), select);
        if (typeof step === 'object' && Array.isArray(step.populate)) {
          step.populate.forEach(nested => {
            if (nested.path === 'periodId') {
              const period = store.periods.find(item => item._id === insight.periodId);
              populatedInsight.periodId = period ? selectFields(clone(period), nested.select) : null;
            }

            if (nested.path === 'sectionId') {
              const section = store.sections.find(item => item._id === insight.sectionId);
              populatedInsight.sectionId = section ? selectFields(clone(section), nested.select) : null;
            }
          });
        }
        result.insightId = populatedInsight;
      }
    });

    return result;
  }

  class QueryChain {
    constructor(items, type, query, single = false) {
      this.items = items;
      this.type = type;
      this.query = query;
      this.single = single;
      this.populateSteps = [];
      this.selectSpec = null;
      this.sortSpec = null;
      this.skipCount = 0;
      this.limitCount = null;
    }

    populate(step, select) {
      if (typeof step === 'string') {
        this.populateSteps.push({ path: step, select });
      } else {
        this.populateSteps.push(step);
      }
      return this;
    }

    select(fields) {
      this.selectSpec = fields;
      return this;
    }

    sort(spec) {
      this.sortSpec = spec;
      return this;
    }

    skip(count) {
      this.skipCount = count;
      return this;
    }

    limit(count) {
      this.limitCount = count;
      return this;
    }

    lean() {
      return this;
    }

    exec() {
      let result = this.items.filter(item => matchesQuery(item, this.query));

      if (this.sortSpec) {
        const [[field, direction]] = Object.entries(this.sortSpec);
        result = result.slice().sort((a, b) => {
          const aValue = new Date(a[field]).getTime();
          const bValue = new Date(b[field]).getTime();
          return direction >= 0 ? aValue - bValue : bValue - aValue;
        });
      }

      if (this.skipCount) {
        result = result.slice(this.skipCount);
      }

      if (this.limitCount !== null) {
        result = result.slice(0, this.limitCount);
      }

      const mapper = this.type === 'insight' ? populateInsightDoc : populateRequestDoc;
      let mapped = result.map(item => mapper(item, this.populateSteps));

      if (this.selectSpec) {
        mapped = mapped.map(item => selectFields(item, this.selectSpec));
      }

      if (this.single) {
        return Promise.resolve(mapped[0] || null);
      }

      return Promise.resolve(mapped);
    }

    then(onFulfilled, onRejected) {
      return this.exec().then(onFulfilled, onRejected);
    }
  }

  function buildController() {
    publishSyncEvents = [];

    const InsightStub = {
      findById(id) {
        const item = store.insights.find(doc => doc._id === id.toString());
        return new QueryChain(item ? [item] : [], 'insight', {}, true);
      },
      find(query) {
        return new QueryChain(store.insights, 'insight', query);
      },
      countDocuments(query) {
        return Promise.resolve(store.insights.filter(item => matchesQuery(item, query)).length);
      },
      create(data) {
        const now = new Date();
        const item = attachInsightMethods({
          _id: createId(),
          imageUrl: null,
          summary: null,
          createdAt: now,
          updatedAt: now,
          ...clone(data)
        });
        store.insights.push(clone(item));
        return Promise.resolve(item);
      },
      findOne() {
        return Promise.resolve(null);
      }
    };

    const InsightRequestStub = {
      find(query) {
        return new QueryChain(store.requests, 'request', query);
      },
      findOne(query) {
        return {
          sort: spec => new QueryChain(store.requests, 'request', query, true).sort(spec).exec()
        };
      },
      findById(id) {
        const item = store.requests.find(doc => doc._id === id.toString());
        return Promise.resolve(item ? attachRequestMethods(clone(item)) : null);
      },
      create(data) {
        const now = new Date();
        const item = attachRequestMethods({
          _id: createId(),
          reason: '',
          approvedAt: null,
          rejectedAt: null,
          revokedAt: null,
          requestPeriodName: '',
          requestInsightTitle: '',
          requestInsightDay: null,
          createdAt: now,
          updatedAt: now,
          auditLog: [],
          ...clone(data)
        });
        store.requests.push(clone(item));
        return Promise.resolve(item);
      }
    };

    const UserStub = {
      findById(id) {
        const user = store.users.find(item => item._id === id.toString());
        return {
          select: fields => Promise.resolve(user ? selectFields(clone(user), fields) : null)
        };
      }
    };

    const EnrollmentStub = {
      findOne() {
        return {
          sort: async () => null
        };
      }
    };

    const PeriodStub = {
      findById(id) {
        const period = store.periods.find(item => item._id === id.toString());
        return {
          select: fields => Promise.resolve(period ? selectFields(clone(period), fields) : null)
        };
      }
    };

    const SectionStub = {
      findById(id) {
        const section = store.sections.find(item => item._id === id.toString());
        return Promise.resolve(section ? clone(section) : null);
      }
    };

    const CheckinStub = {
      findById() {
        return {
          populate: async () => null
        };
      }
    };

    controller = proxyquire('../../src/controllers/insight.controller', {
      '../models/Insight': InsightStub,
      '../models/InsightRequest': InsightRequestStub,
      '../models/User': UserStub,
      '../models/Enrollment': EnrollmentStub,
      '../models/Period': PeriodStub,
      '../models/Section': SectionStub,
      '../models/Checkin': CheckinStub,
      './notification.controller': {
        createNotification: async () => {},
        createNotifications: async () => {}
      },
      '../utils/response': {
        success: (data, message) => ({ code: 0, message, data }),
        errors: {
          badRequest: message => ({ code: 400, message }),
          notFound: message => ({ code: 404, message }),
          forbidden: message => ({ code: 403, message }),
          unauthorized: message => ({ code: 401, message }),
          serverError: message => ({ code: 500, message })
        }
      },
      '../utils/logger': {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {}
      },
      '../services/sync.service': {
        publishSyncEvent: event => {
          publishSyncEvents.push(event);
        }
      }
    });
  }

  function buildApp() {
    const tokenMap = {
      [ownerToken]: store.users[0],
      [requesterToken]: store.users[1]
    };

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.wsManager = { broadcast: () => {} };
      next();
    });

    const authMiddleware = (req, res, next) => {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/u, '');
      const user = tokenMap[token];

      if (!user) {
        return res.status(401).json({ code: 401, message: '未提供认证令牌' });
      }

      req.user = { userId: user._id, role: user.role || 'user' };
      next();
    };

    app.post('/api/v1/insights/requests', authMiddleware, controller.createInsightRequest);
    app.get('/api/v1/insights/user/:userId', authMiddleware, controller.getUserInsights);
    app.get('/api/v1/insights/:insightId', authMiddleware, controller.getInsightDetail);
    app.post('/api/v1/insights/requests/:requestId/approve', authMiddleware, controller.approveInsightRequest);
    app.post('/api/v1/insights/requests/:requestId/reject', authMiddleware, controller.rejectInsightRequest);
    app.get('/api/v1/insights/requests/received', authMiddleware, controller.getReceivedRequests);
    app.get('/api/v1/insights/requests/sent', authMiddleware, controller.getSentRequests);
  }

  beforeEach(() => {
    const ownerId = createId();
    const requesterId = createId();
    const periodId = createId();
    const sectionAId = createId();
    const sectionBId = createId();
    const insightAId = createId();
    const insightBId = createId();

    store = {
      users: [
        { _id: ownerId, nickname: '林泰君', avatar: '🦁', avatarUrl: 'owner.png', role: 'user' },
        { _id: requesterId, nickname: '查看者', avatar: '👀', avatarUrl: 'viewer.png', role: 'user' }
      ],
      periods: [
        { _id: periodId, name: '内在之光', title: '七个习惯晨读营' }
      ],
      sections: [
        { _id: sectionAId, periodId, title: '第三天 以原则为中心的思维方式', day: 3, icon: '📘' },
        { _id: sectionBId, periodId, title: '第四天 先理解，再被理解', day: 4, icon: '📗' }
      ],
      insights: [
        {
          _id: insightAId,
          userId: ownerId,
          targetUserId: ownerId,
          periodId,
          periodName: '内在之光',
          sectionId: sectionAId,
          title: '第三天 以原则为中心的思维方式',
          day: 3,
          type: 'insight',
          mediaType: 'text',
          content: 'A insight content',
          summary: 'A summary',
          status: 'completed',
          isPublished: true,
          createdAt: new Date('2026-03-27T09:00:00.000Z'),
          updatedAt: new Date('2026-03-27T09:00:00.000Z')
        },
        {
          _id: insightBId,
          userId: ownerId,
          targetUserId: ownerId,
          periodId,
          periodName: '内在之光',
          sectionId: sectionBId,
          title: '第四天 先理解，再被理解',
          day: 4,
          type: 'insight',
          mediaType: 'text',
          content: 'B insight content',
          summary: 'B summary',
          status: 'completed',
          isPublished: true,
          createdAt: new Date('2026-03-27T09:10:00.000Z'),
          updatedAt: new Date('2026-03-27T09:10:00.000Z')
        }
      ],
      requests: []
    };

    buildController();
    buildApp();
  });

  it('同一用户对同一条 insight 重复申请时只保留一条记录并刷新 updatedAt', async () => {
    const owner = store.users[0];
    const requester = store.users[1];
    const insightA = store.insights[0];

    const firstRes = await request(app)
      .post('/api/v1/insights/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        toUserId: owner._id,
        insightId: insightA._id
      });

    expect(firstRes.status).to.equal(200);
    expect(store.requests).to.have.lengthOf(1);

    store.requests[0].updatedAt = new Date('2026-03-01T00:00:00.000Z');

    const secondRes = await request(app)
      .post('/api/v1/insights/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        toUserId: owner._id,
        insightId: insightA._id
      });

    expect(secondRes.status).to.equal(200);
    expect(store.requests).to.have.lengthOf(1);
    expect(store.requests[0].fromUserId).to.equal(requester._id);
    expect(store.requests[0].toUserId).to.equal(owner._id);
    expect(store.requests[0].insightId).to.equal(insightA._id);
    expect(store.requests[0].updatedAt.getTime()).to.be.greaterThan(new Date('2026-03-01T00:00:00.000Z').getTime());
  });

  it('批准单条 insight 后，只解锁该条内容，不解锁同一期其他内容', async () => {
    const owner = store.users[0];
    const insightA = store.insights[0];
    const insightB = store.insights[1];

    const createRes = await request(app)
      .post('/api/v1/insights/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        toUserId: owner._id,
        insightId: insightA._id
      });

    expect(createRes.status).to.equal(200);

    const requestId = store.requests[0]._id;

    const approveRes = await request(app)
      .post(`/api/v1/insights/requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    expect(approveRes.status).to.equal(200);

    const listRes = await request(app)
      .get(`/api/v1/insights/user/${owner._id}`)
      .set('Authorization', `Bearer ${requesterToken}`);

    expect(listRes.status).to.equal(200);
    expect(listRes.body.data.list).to.have.lengthOf(2);

    const accessibleItem = listRes.body.data.list.find(item => item._id === insightA._id);
    const lockedItem = listRes.body.data.list.find(item => item._id === insightB._id);

    expect(accessibleItem.isAccessible).to.equal(true);
    expect(accessibleItem.content).to.equal('A insight content');
    expect(lockedItem.isAccessible).to.equal(false);
    expect(lockedItem.content).to.equal(null);
    expect(lockedItem.summary).to.equal(null);

    const accessibleDetailRes = await request(app)
      .get(`/api/v1/insights/${insightA._id}`)
      .set('Authorization', `Bearer ${requesterToken}`);

    expect(accessibleDetailRes.status).to.equal(200);

    const lockedDetailRes = await request(app)
      .get(`/api/v1/insights/${insightB._id}`)
      .set('Authorization', `Bearer ${requesterToken}`);

    expect(lockedDetailRes.status).to.equal(403);
  });

  it('收到和发起的请求列表应保留已处理记录，并按 updatedAt 倒序返回', async () => {
    const owner = store.users[0];
    const insightA = store.insights[0];
    const insightB = store.insights[1];

    const firstCreateRes = await request(app)
      .post('/api/v1/insights/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        toUserId: owner._id,
        insightId: insightA._id
      });

    expect(firstCreateRes.status).to.equal(200);
    const requestAId = store.requests[0]._id;

    const rejectRes = await request(app)
      .post(`/api/v1/insights/requests/${requestAId}/reject`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: '暂不开放' });

    expect(rejectRes.status).to.equal(200);

    await new Promise(resolve => setTimeout(resolve, 15));

    const secondCreateRes = await request(app)
      .post('/api/v1/insights/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        toUserId: owner._id,
        insightId: insightB._id
      });

    expect(secondCreateRes.status).to.equal(200);
    const requestBId = store.requests.find(item => item.insightId === insightB._id)._id;

    const approveRes = await request(app)
      .post(`/api/v1/insights/requests/${requestBId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    expect(approveRes.status).to.equal(200);

    const receivedRes = await request(app)
      .get('/api/v1/insights/requests/received')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(receivedRes.status).to.equal(200);
    expect(receivedRes.body.data).to.have.lengthOf(2);
    expect(receivedRes.body.data[0]._id).to.equal(requestBId);
    expect(receivedRes.body.data[0].status).to.equal('approved');
    expect(receivedRes.body.data[1]._id).to.equal(requestAId);
    expect(receivedRes.body.data[1].status).to.equal('rejected');

    const sentRes = await request(app)
      .get('/api/v1/insights/requests/sent')
      .set('Authorization', `Bearer ${requesterToken}`);

    expect(sentRes.status).to.equal(200);
    expect(sentRes.body.data).to.have.lengthOf(2);
    expect(sentRes.body.data[0]._id).to.equal(requestBId);
    expect(sentRes.body.data[0].status).to.equal('approved');
    expect(sentRes.body.data[1]._id).to.equal(requestAId);
    expect(sentRes.body.data[1].status).to.equal('rejected');
  });
});
