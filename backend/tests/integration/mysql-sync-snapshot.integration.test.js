const { expect } = require('chai');
const mongoose = require('mongoose');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('MySQL sync source snapshot integration', () => {
  let userId;
  let connection;
  let syncService;

  beforeEach(async () => {
    userId = new mongoose.Types.ObjectId();
    await mongoose.connection.db.collection('users').insertOne({
      _id: userId,
      openid: `snapshot-test-${userId}`,
      nickname: '主库昵称',
      buddyHidden: true,
      isNewcomerReceptionist: true
    });
    connection = {
      query: sinon.stub().resolves([{}]),
      release: sinon.spy()
    };
    syncService = proxyquire('../../src/services/sync.service', {
      '../config/database': { mysqlPool: { getConnection: async () => connection } },
      '../utils/logger': { info() {}, warn() {}, error() {} }
    });
  });

  afterEach(async () => {
    await mongoose.connection.db.collection('users').deleteOne({ _id: userId });
  });

  it('reads the complete MongoDB document for an older partial event', async () => {
    const synced = await syncService.syncDocumentToMySQL('users', userId.toString(), {
      _id: userId.toString(),
      nickname: '过期昵称'
    });

    expect(synced).to.equal(true);
    const values = connection.query.secondCall.args[1];
    const snapshot = JSON.parse(values.find(value => typeof value === 'string' && value.startsWith('{')));
    expect(snapshot).to.include({
      nickname: '主库昵称',
      buddyHidden: true,
      isNewcomerReceptionist: true
    });
    expect(values).not.to.include('过期昵称');
  });
});
