const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const { setupFindChain } = require('../helpers/mock-helpers');

describe('Community Activity Controller', () => {
  let sandbox;
  let controller;
  let req;
  let res;
  let CommunityActivityStub;
  let ActivityRegistrationStub;
  let subscribeMessageServiceStub;
  let loggerStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = {
      params: { id: 'activity_1' },
      body: {
        reminderGranted: true,
        reminderGrant: {
          scene: 'activity_reminder',
          templateId: 'TENANT_ACTIVITY_TEMPLATE',
          result: 'accept'
        }
      },
      user: {
        userId: 'user_1',
        openid: 'openid_1'
      }
    };
    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };

    CommunityActivityStub = {
      findOne: sandbox.stub(),
      countDocuments: sandbox.stub()
    };
    ActivityRegistrationStub = {
      findOne: sandbox.stub(),
      countDocuments: sandbox.stub(),
      create: sandbox.stub()
    };

    subscribeMessageServiceStub = {
      recordUserGrantResults: sandbox.stub().resolves()
    };
    loggerStub = {
      error: sandbox.stub(),
      warn: sandbox.stub()
    };

    controller = proxyquire('../../../src/controllers/communityActivity.controller', {
      '../models/CommunityActivity': CommunityActivityStub,
      '../models/ActivityRegistration': ActivityRegistrationStub,
      '../models/Payment': {
        updateMany: sandbox.stub(),
        createOrder: sandbox.stub()
      },
      '../models/ActivityCoupon': {
        findOne: sandbox.stub()
      },
      '../services/payment.service': {
        resolveWechatPayConfig: sandbox.stub(),
        unifiedOrder: sandbox.stub(),
        generatePaymentParams: sandbox.stub()
      },
      '../services/subscribe-message.service': subscribeMessageServiceStub,
      '../utils/response': {
        success: (data, message) => ({ code: 200, message, data }),
        errors: {
          badRequest: (msg) => ({ code: 400, message: msg }),
          forbidden: (msg) => ({ code: 403, message: msg }),
          notFound: (msg) => ({ code: 404, message: msg }),
          serverError: (msg) => ({ code: 500, message: msg })
        }
      },
      '../utils/logger': loggerStub,
      '../utils/tenantContext': {
        getCurrentTenantId: sandbox.stub().returns('tenant_1')
      }
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  function mockFreePublishedActivity() {
    CommunityActivityStub.findOne.returns(setupFindChain(sandbox, {
      _id: 'activity_1',
      tenantId: 'tenant_1',
      title: '活动提醒测试',
      status: 'published',
      maxParticipants: 0,
      isPaid: false,
      price: 0,
      registrationForm: { enabled: false, fields: [] }
    }));
    ActivityRegistrationStub.findOne.resolves(null);
    ActivityRegistrationStub.create.resolves({
      _id: 'registration_1',
      activityId: 'activity_1',
      userId: 'user_1',
      reminderGranted: true
    });
  }

  describe('registerActivity', () => {
    it('records accepted activity reminder grant with activity context', async () => {
      mockFreePublishedActivity();

      await controller.registerActivity(req, res);

      expect(subscribeMessageServiceStub.recordUserGrantResults.calledOnce).to.be.true;
      expect(subscribeMessageServiceStub.recordUserGrantResults.firstCall.args[0]).to.equal('user_1');
      expect(subscribeMessageServiceStub.recordUserGrantResults.firstCall.args[1]).to.deep.equal([
        {
          scene: 'activity_reminder',
          templateId: 'TENANT_ACTIVITY_TEMPLATE',
          result: 'accept',
          context: {
            activityId: 'activity_1',
            sourceAction: 'community_activity_register'
          }
        }
      ]);
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0].code).to.equal(200);
    });

    it('stores normalized form answers for free activity registrations', async () => {
      CommunityActivityStub.findOne.returns(setupFindChain(sandbox, {
        _id: 'activity_1',
        tenantId: 'tenant_1',
        title: '线下聚会',
        status: 'published',
        maxParticipants: 0,
        isPaid: false,
        price: 0,
        registrationForm: {
          enabled: true,
          fields: [
            {
              fieldId: 'city',
              label: '所在城市',
              type: 'single_select',
              required: true,
              includeInStats: true,
              options: [
                { optionId: 'sh', label: '上海' },
                { optionId: 'hz', label: '杭州' }
              ],
              sortOrder: 0
            }
          ]
        }
      }));
      req.body.formAnswers = { city: 'sh' };
      ActivityRegistrationStub.findOne.resolves(null);
      ActivityRegistrationStub.create.resolves({
        _id: 'registration_1',
        formAnswers: [{ fieldId: 'city', valueText: '上海' }]
      });

      await controller.registerActivity(req, res);

      expect(ActivityRegistrationStub.create.calledOnce).to.equal(true);
      const payload = ActivityRegistrationStub.create.firstCall.args[0];
      expect(payload.formSnapshot.enabled).to.equal(true);
      expect(payload.formAnswers[0]).to.deep.include({
        fieldId: 'city',
        label: '所在城市',
        type: 'single_select',
        value: 'sh',
        valueText: '上海'
      });
      expect(res.json.firstCall.args[0].message).to.equal('报名成功');
    });

    it('returns 400 and does not create registration when required answer is missing', async () => {
      CommunityActivityStub.findOne.returns(setupFindChain(sandbox, {
        _id: 'activity_1',
        tenantId: 'tenant_1',
        title: '线下聚会',
        status: 'published',
        maxParticipants: 0,
        isPaid: false,
        price: 0,
        registrationForm: {
          enabled: true,
          fields: [
            {
              fieldId: 'city',
              label: '所在城市',
              type: 'text',
              required: true,
              options: [],
              sortOrder: 0
            }
          ]
        }
      }));
      req.body.formAnswers = {};

      await controller.registerActivity(req, res);

      expect(res.status.calledWith(400)).to.equal(true);
      expect(res.json.firstCall.args[0].message).to.equal('请填写所在城市');
      expect(ActivityRegistrationStub.create.called).to.equal(false);
    });

    it('does not block registration when recording activity reminder grant fails', async () => {
      mockFreePublishedActivity();
      subscribeMessageServiceStub.recordUserGrantResults.rejects(new Error('template mismatch'));

      await controller.registerActivity(req, res);

      expect(loggerStub.warn.calledOnce).to.be.true;
      expect(res.status.called).to.be.false;
      expect(res.json.calledOnce).to.be.true;
      const response = res.json.firstCall.args[0];
      expect(response.code).to.equal(200);
      expect(response.message).to.equal('报名成功');
      expect(response.data._id).to.equal('registration_1');
    });
  });
});
