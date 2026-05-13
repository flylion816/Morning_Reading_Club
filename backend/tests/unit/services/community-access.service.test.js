const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('community-access.service', () => {
  let sandbox;
  let EnrollmentStub;
  let service;
  let res;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    EnrollmentStub = {
      findOne: sandbox.stub()
    };
    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };

    service = proxyquire('../../../src/services/community-access.service', {
      '../models/Enrollment': EnrollmentStub,
      '../utils/response': {
        errors: {
          forbidden: msg => ({ code: 403, message: msg })
        }
      }
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  function mockEnrollment(enrollment) {
    EnrollmentStub.findOne.returns({
      select: sandbox.stub().resolves(enrollment)
    });
  }

  it('should allow paid enrollments to access community features', async () => {
    mockEnrollment({ paymentStatus: 'paid', status: 'active' });

    const result = await service.ensurePeriodCommunityAccess(res, 'user_1', 'period_1');

    expect(result).to.equal(true);
    expect(res.status.called).to.equal(false);
  });

  it('should deny free enrollments from community features', async () => {
    mockEnrollment({ paymentStatus: 'free', status: 'active' });

    const result = await service.ensurePeriodCommunityAccess(res, 'user_1', 'period_1');

    expect(result).to.equal(false);
    expect(res.status.calledWith(403)).to.equal(true);
    expect(res.json.getCall(0).args[0]).to.deep.include({
      code: 403,
      message: service.COMMUNITY_ACCESS_DENIED_MESSAGE
    });
  });
});
