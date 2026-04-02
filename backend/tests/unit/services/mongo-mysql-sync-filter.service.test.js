const { expect } = require('chai');
const mongoose = require('mongoose');

const {
  filterDocumentsForMysqlSync,
  getSkipReason
} = require('../../../src/services/mongo-mysql-sync-filter.service');

describe('Mongo MySQL Sync Filter Service', () => {
  const validUserId = new mongoose.Types.ObjectId().toString();
  const validPeriodId = new mongoose.Types.ObjectId().toString();
  const validSectionId = new mongoose.Types.ObjectId().toString();
  const validEnrollmentId = new mongoose.Types.ObjectId().toString();
  const validCheckinId = new mongoose.Types.ObjectId().toString();
  const validInsightId = new mongoose.Types.ObjectId().toString();
  const validRequestId = new mongoose.Types.ObjectId().toString();
  const validCommentId = new mongoose.Types.ObjectId().toString();

  const context = {
    userIds: new Set([validUserId]),
    periodIds: new Set([validPeriodId]),
    sectionIds: new Set([validSectionId]),
    enrollmentIds: new Set([validEnrollmentId]),
    checkinIds: new Set([validCheckinId]),
    insightIds: new Set([validInsightId]),
    requestIds: new Set([validRequestId]),
    commentIds: new Set([validCommentId])
  };

  it('should skip orphan insights with missing userId', () => {
    const documents = [
      {
        _id: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(),
        targetUserId: validUserId,
        periodId: validPeriodId
      }
    ];

    const result = filterDocumentsForMysqlSync('insights', documents, context);

    expect(result.syncableDocs).to.have.length(0);
    expect(result.skippedDocs).to.have.length(1);
    expect(result.skippedDocs[0].reason).to.match(/^userId .* missing$/);
  });

  it('should keep insight requests when requester and receiver still exist', () => {
    const documents = [
      {
        _id: new mongoose.Types.ObjectId(),
        fromUserId: validUserId,
        toUserId: validUserId,
        insightId: validInsightId
      }
    ];

    const result = filterDocumentsForMysqlSync('insight_requests', documents, context);

    expect(result.syncableDocs).to.have.length(1);
    expect(result.skippedDocs).to.have.length(0);
  });

  it('should skip payments when enrollmentId no longer exists', () => {
    const reason = getSkipReason('payments', {
      _id: new mongoose.Types.ObjectId(),
      userId: validUserId,
      periodId: validPeriodId,
      enrollmentId: new mongoose.Types.ObjectId()
    }, context);

    expect(reason).to.match(/^enrollmentId .* missing$/);
  });

  it('should skip insight requests when insightId no longer exists', () => {
    const reason = getSkipReason('insight_requests', {
      _id: new mongoose.Types.ObjectId(),
      fromUserId: validUserId,
      toUserId: validUserId,
      insightId: new mongoose.Types.ObjectId()
    }, context);

    expect(reason).to.match(/^insightId .* missing$/);
  });

  it('should skip comments when replyToUserId no longer exists', () => {
    const reason = getSkipReason('comments', {
      _id: new mongoose.Types.ObjectId(),
      userId: validUserId,
      checkinId: validCheckinId,
      replyToUserId: new mongoose.Types.ObjectId()
    }, context);

    expect(reason).to.match(/^replyToUserId .* missing$/);
  });

  it('should skip notifications when userId no longer exists', () => {
    const reason = getSkipReason('notifications', {
      _id: new mongoose.Types.ObjectId(),
      userId: new mongoose.Types.ObjectId()
    }, context);

    expect(reason).to.match(/^userId .* missing$/);
  });

  it('should skip notifications when senderId no longer exists', () => {
    const reason = getSkipReason('notifications', {
      _id: new mongoose.Types.ObjectId(),
      userId: validUserId,
      senderId: new mongoose.Types.ObjectId()
    }, context);

    expect(reason).to.match(/^senderId .* missing$/);
  });

  it('should skip notifications when requestId no longer exists', () => {
    const reason = getSkipReason('notifications', {
      _id: new mongoose.Types.ObjectId(),
      userId: validUserId,
      requestId: new mongoose.Types.ObjectId()
    }, context);

    expect(reason).to.match(/^requestId .* missing$/);
  });

  it('should skip notifications when data.commentId no longer exists', () => {
    const reason = getSkipReason('notifications', {
      _id: new mongoose.Types.ObjectId(),
      userId: validUserId,
      data: {
        commentId: new mongoose.Types.ObjectId()
      }
    }, context);

    expect(reason).to.match(/^data\.commentId .* missing$/);
  });

  it('should keep notifications when dependent ids still exist', () => {
    const documents = [
      {
        _id: new mongoose.Types.ObjectId(),
        userId: validUserId,
        senderId: validUserId,
        requestId: validRequestId,
        data: {
          checkinId: validCheckinId,
          commentId: validCommentId,
          insightRequestId: validRequestId
        }
      }
    ];

    const result = filterDocumentsForMysqlSync('notifications', documents, context);

    expect(result.syncableDocs).to.have.length(1);
    expect(result.skippedDocs).to.have.length(0);
  });
});
