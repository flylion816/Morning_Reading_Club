const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

const { transformDocumentForMySQL, buildUpsertStatement } = require('../../../src/services/sync.service');

describe('Sync Service', () => {
  describe('transformDocumentForMySQL', () => {
    it('should exclude payment virtual fields that do not exist in MySQL', () => {
      const transformed = transformDocumentForMySQL('payments', {
        _id: { toString: () => 'payment123' },
        status: 'processing',
        failureReason: '网络超时',
        notes: '管理员备注',
        reconciledAt: new Date('2026-04-05T09:00:00.000Z'),
        isPaid: false,
        isProcessing: true
      });

      expect(transformed).to.include({
        id: 'payment123',
        status: 'processing',
        failure_reason: '网络超时',
        notes: '管理员备注',
        is_paid: 0
      });
      expect(transformed.reconciled_at).to.equal('2026-04-05 09:00:00');
      expect(transformed).to.not.have.property('is_processing');
    });

    it('should convert ObjectId-like foreign keys to 24-char strings', () => {
      const makeObjectId = (value) => ({
        _bsontype: 'ObjectId',
        toString: () => value
      });

      const transformed = transformDocumentForMySQL('payments', {
        _id: makeObjectId('69d1167bf6ee02a393891f7d'),
        enrollmentId: makeObjectId('69d1167bf6ee02a393891f7c'),
        userId: makeObjectId('69d1167bf6ee02a393891f7b'),
        periodId: makeObjectId('69d1167bf6ee02a393891f7a')
      });

      expect(transformed).to.include({
        id: '69d1167bf6ee02a393891f7d',
        enrollment_id: '69d1167bf6ee02a393891f7c',
        user_id: '69d1167bf6ee02a393891f7b',
        period_id: '69d1167bf6ee02a393891f7a'
      });
    });

    it('should preserve insight snapshot fields for MySQL snake_case columns', () => {
      const transformed = transformDocumentForMySQL('insights', {
        _id: { toString: () => 'insight123' },
        periodName: '内在之光',
        title: '第十八天 移情聆听',
        mediaType: 'text'
      });

      expect(transformed).to.include({
        id: 'insight123',
        period_name: '内在之光',
        title: '第十八天 移情聆听',
        media_type: 'text'
      });
    });

    it('should exclude fields without dedicated MySQL columns from realtime sync', () => {
      const transformed = transformDocumentForMySQL('insights', {
        _id: 'insight123',
        readAt: new Date('2026-11-23T08:00:00.000Z')
      });

      expect(transformed).not.to.have.property('read_at');
      expect(JSON.parse(transformed.raw_json).readAt).to.equal('2026-11-23T08:00:00.000Z');

      const user = transformDocumentForMySQL('users', {
        _id: 'user123',
        isNewcomerReceptionist: true,
        buddyHidden: true
      });
      expect(user).not.to.have.property('is_newcomer_receptionist');
      expect(user).not.to.have.property('buddy_hidden');
      expect(JSON.parse(user.raw_json)).to.include({ isNewcomerReceptionist: true, buddyHidden: true });
    });

    it('should make JSON values well-formed for MySQL JSON columns', () => {
      const transformed = transformDocumentForMySQL('notifications', {
        _id: 'notification123',
        data: { preview: 'a\uDC00b\uD83Dc', emoji: '😀', literal: '\\udc00' }
      });

      expect(JSON.parse(transformed.data)).to.deep.equal({
        preview: 'a\uFFFDb\uFFFDc',
        emoji: '😀',
        literal: '\\udc00'
      });
      expect(JSON.parse(transformed.raw_json).data).to.deep.equal(JSON.parse(transformed.data));
    });

    it('should preserve checkin rich text HTML for MySQL sync', () => {
      const transformed = transformDocumentForMySQL('checkins', {
        _id: { toString: () => 'checkin123' },
        note: '要事第一',
        contentHtml: '<p><strong>要事第一</strong></p>'
      });

      expect(transformed).to.include({
        id: 'checkin123',
        note: '要事第一',
        content_html: '<p><strong>要事第一</strong></p>'
      });
    });

    it('should normalize enrollment yes/no fields before syncing to MySQL', () => {
      const transformed = transformDocumentForMySQL('enrollments', {
        _id: { toString: () => 'enrollment123' },
        hasReadBook: true,
        commitment: false,
        isPaid: true,
        isActive: true
      });

      expect(transformed).to.include({
        id: 'enrollment123',
        has_read_book: 'yes',
        commitment: 'no'
      });
      expect(transformed).to.not.have.property('is_paid');
      expect(transformed).to.not.have.property('is_active');
    });

    it('should quote reserved section column names in generated upsert SQL', () => {
      const { query, values, columns } = buildUpsertStatement('sections', {
        id: 'section123',
        order: 1,
        checkin_count: 2
      });

      expect(columns).to.deep.equal(['id', 'order', 'checkin_count']);
      expect(values).to.deep.equal(['section123', 1, 2]);
      expect(query).to.include('INSERT INTO `sections` (`id`,`order`,`checkin_count`)');
      expect(query).to.include('`order`=VALUES(`order`)');
      expect(query).to.include('`checkin_count`=VALUES(`checkin_count`)');
    });
  });

  describe('syncDocumentToMySQL', () => {
    let connection;
    let sourceCollection;
    let pool;
    let syncDocumentToMySQL;

    beforeEach(() => {
      connection = {
        query: sinon.stub().resolves([{}]),
        release: sinon.spy()
      };
      sourceCollection = { findOne: sinon.stub() };
      pool = { getConnection: sinon.stub().resolves(connection) };
      const mongooseStub = {
        isValidObjectId: sinon.stub().returns(true),
        Types: { ObjectId: class ObjectId {
          constructor(value) { this.value = value; }
        } },
        connection: { db: { collection: sinon.stub().returns(sourceCollection) } }
      };
      ({ syncDocumentToMySQL } = proxyquire('../../../src/services/sync.service', {
        mongoose: mongooseStub,
        '../config/database': { mysqlPool: pool },
        '../utils/logger': { info: sinon.spy(), warn: sinon.spy(), error: sinon.spy() },
        './course-template-backup': { ensureCourseTemplateTable: sinon.stub().resolves() }
      }));
    });

    it('backs up the complete current document when an event contains only a partial update', async () => {
      sourceCollection.findOne.resolves({
        _id: 'user123',
        openid: 'openid-test',
        nickname: '当前昵称',
        buddyHidden: true,
        isNewcomerReceptionist: true
      });

      const success = await syncDocumentToMySQL('users', 'user123', {
        _id: 'user123',
        nickname: '旧昵称'
      });

      expect(success).to.equal(true);
      const [query, values] = connection.query.secondCall.args;
      expect(query).to.include('`raw_json`');
      expect(query).not.to.include('`buddy_hidden`');
      expect(values).to.include('当前昵称');
      expect(values).not.to.include('旧昵称');
      const snapshot = JSON.parse(values.find(value => typeof value === 'string' && value.startsWith('{')));
      expect(snapshot).to.include({
        openid: 'openid-test',
        nickname: '当前昵称',
        buddyHidden: true,
        isNewcomerReceptionist: true
      });
      expect(connection.release.calledOnce).to.equal(true);
    });

    it('does not write a partial event to MySQL when the source lookup fails', async () => {
      sourceCollection.findOne.rejects(new Error('MongoDB unavailable'));

      const success = await syncDocumentToMySQL('users', 'user123', { _id: 'user123', nickname: '局部信息' });

      expect(success).to.equal(false);
      expect(pool.getConnection.called).to.equal(false);
    });

    it('does not include an administrator database access password in the backup snapshot', async () => {
      sourceCollection.findOne.resolves({
        _id: 'admin123',
        sessionVersion: 4,
        password: 'password-hash',
        dbAccessPassword: 'must-not-be-synced'
      });

      const success = await syncDocumentToMySQL('admins', 'admin123', { _id: 'admin123' });

      expect(success).to.equal(true);
      expect(sourceCollection.findOne.firstCall.args[1]).to.deep.equal({
        projection: { dbAccessPassword: 0 }
      });
      const values = connection.query.secondCall.args[1];
      expect(JSON.stringify(values)).not.to.include('must-not-be-synced');
      const snapshot = JSON.parse(values.find(value => typeof value === 'string' && value.startsWith('{')));
      expect(snapshot).to.include({ sessionVersion: 4 });
      expect(snapshot).not.to.have.property('password');
      expect(snapshot).not.to.have.property('dbAccessPassword');
    });

    it('does not recreate a deleted source document from an old event', async () => {
      sourceCollection.findOne.resolves(null);

      const success = await syncDocumentToMySQL('insights', 'insight123', { _id: 'insight123' });

      expect(success).to.equal(true);
      expect(pool.getConnection.called).to.equal(false);
    });
  });
});
