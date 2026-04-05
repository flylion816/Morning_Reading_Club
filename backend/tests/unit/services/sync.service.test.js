const { expect } = require('chai');

const { transformDocumentForMySQL } = require('../../../src/services/sync.service');

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
  });
});
