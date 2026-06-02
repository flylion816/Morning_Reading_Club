const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('Imprint Routes', () => {
  let sandbox;
  let EnrollmentStub;
  let controllerStub;
  let activityTypeControllerStub;
  let router;

  function buildRouter() {
    const multerStub = () => ({
      single: () => (req, res, next) => next()
    });
    multerStub.diskStorage = sandbox.stub().returns({});

    const router = proxyquire('../../../src/routes/imprint.routes', {
      multer: multerStub,
      fs: {
        existsSync: () => true,
        mkdirSync: sandbox.stub()
      },
      '../middleware/auth': {
        authMiddleware: (req, res, next) => {
          req.user = { _id: 'user_1', userId: 'user_1' };
          next();
        },
        optionalAuthMiddleware: (req, res, next) => next()
      },
      '../middleware/adminAuth': {
        adminAuthMiddleware: (req, res, next) => next()
      },
      '../middleware/tenantContext': {
        userTenantContext: (req, res, next) => next(),
        adminTenantContext: (req, res, next) => next(),
        optionalUserOrPublicTenantContext: (req, res, next) => next()
      },
      '../utils/tenantContext': {
        getCurrentTenantId: () => 'tenant_1'
      },
      '../utils/tenantSlug': {
        resolveTenantSlug: sandbox.stub().resolves('test-tenant')
      },
      '../utils/response': {
        success: data => ({ code: 0, data }),
        errors: {
          badRequest: message => ({ code: 400, message })
        }
      },
      '../models/Enrollment': EnrollmentStub,
      '../controllers/imprint.controller': controllerStub,
      '../controllers/imprintActivityType.controller': activityTypeControllerStub
    });

    return router;
  }

  function getRouteIndex(path, method) {
    return router.stack.findIndex(layer =>
      layer.route &&
      layer.route.path === path &&
      layer.route.methods[method]
    );
  }

  function getMiddleware(name) {
    const layer = router.stack.find(item => item.name === name);
    return layer && layer.handle;
  }

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    EnrollmentStub = {
      findOne: sandbox.stub()
    };
    controllerStub = {
      list: (req, res) => res.json({ code: 0, data: { list: [] } }),
      create: (req, res) => res.json({ code: 0, data: {} }),
      detail: (req, res) => res.json({ code: 0, data: { imprint: { _id: req.params.id } } }),
      update: (req, res) => res.json({ code: 0, data: {} }),
      remove: (req, res) => res.json({ code: 0, data: {} }),
      attend: (req, res) => res.json({ code: 0, data: {} }),
      cancelAttend: (req, res) => res.json({ code: 0, data: {} }),
      react: (req, res) => res.json({ code: 0, data: {} }),
      cancelReaction: (req, res) => res.json({ code: 0, data: {} }),
      listComments: (req, res) => res.json({ code: 0, data: { list: [] } }),
      createComment: (req, res) => res.json({ code: 0, data: {} }),
      deleteComment: (req, res) => res.json({ code: 0, data: {} }),
      adminList: (req, res) => res.json({ code: 0, data: { list: [] } }),
      adminUpdate: (req, res) => res.json({ code: 0, data: {} }),
      adminRemove: (req, res) => res.json({ code: 0, data: {} })
    };
    activityTypeControllerStub = {
      list: (req, res) => res.json({ code: 0, data: { list: [] } }),
      adminList: (req, res) => res.json({ code: 0, data: { list: [] } }),
      create: (req, res) => res.json({ code: 0, data: {} }),
      reorder: (req, res) => res.json({ code: 0, data: {} }),
      update: (req, res) => res.json({ code: 0, data: {} }),
      remove: (req, res) => res.json({ code: 0, data: {} })
    };
    router = buildRouter();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('未付费用户访问受保护印记接口应返回 403', async () => {
    EnrollmentStub.findOne.returns({
      lean: sandbox.stub().resolves(null)
    });
    const middleware = getMiddleware('requirePaidEnrollment');
    const req = { user: { _id: 'user_1' } };
    const res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };
    const next = sandbox.stub();

    await middleware(req, res, next);

    expect(res.status.calledWith(403)).to.equal(true);
    expect(res.json.getCall(0).args[0].message).to.equal('完成支付后可使用在场功能');
    expect(next.called).to.equal(false);
  });

  it('已付费用户通过付费守卫', async () => {
    EnrollmentStub.findOne.returns({
      lean: sandbox.stub().resolves({
        userId: 'user_1',
        tenantId: 'tenant_1',
        paymentStatus: 'paid',
        status: 'active'
      })
    });
    const middleware = getMiddleware('requirePaidEnrollment');
    const req = { user: { _id: 'user_1' } };
    const res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };
    const next = sandbox.stub();

    await middleware(req, res, next);

    expect(next.calledOnce).to.equal(true);
    expect(res.status.called).to.equal(false);
  });

  it('详情接口在付费守卫前注册，分享落地无需报名记录', async () => {
    const detailIndex = getRouteIndex('/:id', 'get');
    const guardIndex = router.stack.findIndex(layer => layer.name === 'requirePaidEnrollment');

    expect(detailIndex).to.be.lessThan(guardIndex);
  });

  it('activity-types 静态路由不应被 :id 吞掉', async () => {
    const activityTypesIndex = getRouteIndex('/activity-types', 'get');
    const detailIndex = getRouteIndex('/:id', 'get');

    expect(activityTypesIndex).to.be.lessThan(detailIndex);
  });
});
