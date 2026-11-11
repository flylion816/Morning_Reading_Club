const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

const oid = () => new mongoose.Types.ObjectId();
const chain = rows => {
  const c = {};
  c.select = () => c;
  c.sort = () => c;
  c.lean = () => Promise.resolve(rows);
  return c;
};

describe('Presence Controller', () => {
  let sandbox;
  let req;
  let res;
  let stubs;
  let controller;
  let access;
  const userId = oid();
  const sectionId = oid();
  const periodId = oid();

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    req = { body: {}, query: {}, params: {}, user: { _id: userId } };
    res = { status: sandbox.stub().returnsThis(), json: sandbox.stub().returnsThis() };
    access = sandbox.stub().resolves(true);
    stubs = {
      ReadingPing: { findOneAndUpdate: sandbox.stub().resolves({}), find: sandbox.stub() },
      Section: { findById: sandbox.stub().returns(chain({ periodId })) },
      Enrollment: { find: sandbox.stub() },
      Completion: { find: sandbox.stub() },
      Checkin: { find: sandbox.stub() }
    };
    controller = proxyquire('../../../src/controllers/presence.controller', {
      '../models/ReadingPing': stubs.ReadingPing,
      '../models/Section': stubs.Section,
      '../models/Enrollment': stubs.Enrollment,
      '../models/UserReadingCompletion': stubs.Completion,
      '../models/Checkin': stubs.Checkin,
      '../services/community-access.service': { ensurePeriodCommunityAccess: access },
      '../utils/tenantContext': { getCurrentTenantId: () => 'tenant1' }
    });
    controller.resetCachesForTest();
  });
  afterEach(() => sandbox.restore());

  it('reportReading upserts and throttles repeats within 60s', async () => {
    req.body.sectionId = String(sectionId);
    await controller.reportReading(req, res);
    await controller.reportReading(req, res);
    expect(stubs.ReadingPing.findOneAndUpdate.calledOnce).to.equal(true);
    expect(res.json.callCount).to.equal(2);
    expect(res.json.firstCall.args[0].data).to.deep.equal({ ok: true });
  });

  it('reportReading rejects missing section and unenrolled users', async () => {
    req.body.sectionId = String(sectionId);
    stubs.Section.findById.returns(chain(null));
    await controller.reportReading(req, res);
    expect(res.status.calledWith(404)).to.equal(true);

    stubs.Section.findById.returns(chain({ periodId }));
    access.resolves(false);
    await controller.reportReading(req, res);
    expect(stubs.ReadingPing.findOneAndUpdate.called).to.equal(false);
  });

  it('getToday hides counts below 3 and caches results', async () => {
    req.query.periodId = String(periodId);
    const ids = [oid(), oid(), oid(), oid()];
    stubs.ReadingPing.find.returns(chain(ids.map(u => ({ userId: u }))));
    stubs.Completion.find.returns(chain([{ userId: ids[0] }, { userId: ids[0] }, { userId: ids[1] }]));
    stubs.Checkin.find.returns(chain(ids.slice(0, 3).map(u => ({ userId: u }))));
    await controller.getToday(req, res);
    expect(res.json.firstCall.args[0].data).to.deep.equal({
      readingNow: 4,
      completedToday: null,
      checkedInToday: 3
    });
    await controller.getToday(req, res);
    expect(stubs.ReadingPing.find.calledOnce).to.equal(true);
  });

  it('getMyRank returns de-duplicated rank or null', async () => {
    req.query = { sectionId: String(sectionId), type: 'reading' };
    const other = oid();
    stubs.Completion.find.returns(
      chain([{ userId: other }, { userId: other }, { userId }])
    );
    await controller.getMyRank(req, res);
    expect(res.json.firstCall.args[0].data).to.deep.equal({ rank: 2 });

    req.query.type = 'checkin';
    stubs.Checkin.find.returns(chain([{ userId: other }]));
    await controller.getMyRank(req, res);
    expect(res.json.secondCall.args[0].data).to.deep.equal({ rank: null });
  });

  it('getMyRank rejects invalid type', async () => {
    req.query = { sectionId: String(sectionId), type: 'x' };
    await controller.getMyRank(req, res);
    expect(res.status.calledWith(400)).to.equal(true);
  });

  it('getPeriodOrigins returns counts and hides provinceCount below 2', async () => {
    req.params.periodId = String(periodId);
    stubs.Enrollment.find.returns(chain([{ province: '浙江' }, { province: ' 浙江 ' }, {}]));
    await controller.getPeriodOrigins(req, res);
    expect(res.json.firstCall.args[0].data).to.deep.equal({ memberCount: 3, provinceCount: null });

    stubs.Enrollment.find.returns(chain([{ province: '浙江' }, { province: '广东' }]));
    await controller.getPeriodOrigins(req, res);
    expect(res.json.secondCall.args[0].data).to.deep.equal({ memberCount: 2, provinceCount: 2 });
    expect(stubs.Enrollment.find.secondCall.args[0].paymentStatus).to.deep.equal({ $in: ['paid', 'free'] });
  });
});
