const User = require('../models/User');
const Period = require('../models/Period');
const Section = require('../models/Section');
const Enrollment = require('../models/Enrollment');
const Checkin = require('../models/Checkin');
const Insight = require('../models/Insight');
const InsightRequest = require('../models/InsightRequest');
const Comment = require('../models/Comment');

function toIdString(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value.toString === 'function') {
    return value.toString();
  }

  return String(value);
}

function toIdSet(rows) {
  return new Set(rows.map(row => toIdString(row._id)).filter(Boolean));
}

async function buildSyncReferenceContext(models = {}) {
  const {
    UserModel = User,
    PeriodModel = Period,
    SectionModel = Section,
    EnrollmentModel = Enrollment,
    CheckinModel = Checkin,
    InsightModel = Insight,
    InsightRequestModel = InsightRequest,
    CommentModel = Comment
  } = models;

  const [users, periods, sections, enrollments, checkins, insights, insightRequests, comments] = await Promise.all([
    UserModel.find({}, { _id: 1 }).lean(),
    PeriodModel.find({}, { _id: 1 }).lean(),
    SectionModel.find({}, { _id: 1 }).lean(),
    EnrollmentModel.find({}, { _id: 1 }).lean(),
    CheckinModel.find({}, { _id: 1 }).lean(),
    InsightModel.find({}, { _id: 1 }).lean(),
    InsightRequestModel.find({}, { _id: 1 }).lean(),
    CommentModel.find({}, { _id: 1 }).lean()
  ]);

  return {
    userIds: toIdSet(users),
    periodIds: toIdSet(periods),
    sectionIds: toIdSet(sections),
    enrollmentIds: toIdSet(enrollments),
    checkinIds: toIdSet(checkins),
    insightIds: toIdSet(insights),
    requestIds: toIdSet(insightRequests),
    commentIds: toIdSet(comments)
  };
}

function getSkipReason(taskName, doc, context) {
  const userId = toIdString(doc.userId);
  const periodId = toIdString(doc.periodId);
  const sectionId = toIdString(doc.sectionId);
  const enrollmentId = toIdString(doc.enrollmentId);
  const checkinId = toIdString(doc.checkinId);
  const targetUserId = toIdString(doc.targetUserId);
  const fromUserId = toIdString(doc.fromUserId);
  const toUserId = toIdString(doc.toUserId);
  const replyToUserId = toIdString(doc.replyToUserId);
  const senderId = toIdString(doc.senderId);
  const insightId = toIdString(doc.insightId);
  const requestId = toIdString(doc.requestId);
  const notificationData = doc.data || {};
  const dataCheckinId = toIdString(notificationData.checkinId);
  const dataCommentId = toIdString(notificationData.commentId);
  const dataInsightRequestId = toIdString(notificationData.insightRequestId);

  switch (taskName) {
    case 'sections':
      if (periodId && !context.periodIds.has(periodId)) {
        return `periodId ${periodId} missing`;
      }
      return null;
    case 'checkins':
      if (userId && !context.userIds.has(userId)) {
        return `userId ${userId} missing`;
      }
      if (periodId && !context.periodIds.has(periodId)) {
        return `periodId ${periodId} missing`;
      }
      if (sectionId && !context.sectionIds.has(sectionId)) {
        return `sectionId ${sectionId} missing`;
      }
      return null;
    case 'enrollments':
      if (userId && !context.userIds.has(userId)) {
        return `userId ${userId} missing`;
      }
      if (periodId && !context.periodIds.has(periodId)) {
        return `periodId ${periodId} missing`;
      }
      return null;
    case 'payments':
      if (userId && !context.userIds.has(userId)) {
        return `userId ${userId} missing`;
      }
      if (periodId && !context.periodIds.has(periodId)) {
        return `periodId ${periodId} missing`;
      }
      if (enrollmentId && !context.enrollmentIds.has(enrollmentId)) {
        return `enrollmentId ${enrollmentId} missing`;
      }
      return null;
    case 'insights':
      if (userId && !context.userIds.has(userId)) {
        return `userId ${userId} missing`;
      }
      if (targetUserId && !context.userIds.has(targetUserId)) {
        return `targetUserId ${targetUserId} missing`;
      }
      if (periodId && !context.periodIds.has(periodId)) {
        return `periodId ${periodId} missing`;
      }
      return null;
    case 'insight_requests':
      if (fromUserId && !context.userIds.has(fromUserId)) {
        return `fromUserId ${fromUserId} missing`;
      }
      if (toUserId && !context.userIds.has(toUserId)) {
        return `toUserId ${toUserId} missing`;
      }
      if (insightId && !context.insightIds.has(insightId)) {
        return `insightId ${insightId} missing`;
      }
      return null;
    case 'comments':
      if (userId && !context.userIds.has(userId)) {
        return `userId ${userId} missing`;
      }
      if (replyToUserId && !context.userIds.has(replyToUserId)) {
        return `replyToUserId ${replyToUserId} missing`;
      }
      if (checkinId && !context.checkinIds.has(checkinId)) {
        return `checkinId ${checkinId} missing`;
      }
      return null;
    case 'notifications':
      if (userId && !context.userIds.has(userId)) {
        return `userId ${userId} missing`;
      }
      if (senderId && !context.userIds.has(senderId)) {
        return `senderId ${senderId} missing`;
      }
      if (requestId && !context.requestIds.has(requestId)) {
        return `requestId ${requestId} missing`;
      }
      if (dataCheckinId && !context.checkinIds.has(dataCheckinId)) {
        return `data.checkinId ${dataCheckinId} missing`;
      }
      if (dataCommentId && !context.commentIds.has(dataCommentId)) {
        return `data.commentId ${dataCommentId} missing`;
      }
      if (dataInsightRequestId && !context.requestIds.has(dataInsightRequestId)) {
        return `data.insightRequestId ${dataInsightRequestId} missing`;
      }
      return null;
    default:
      return null;
  }
}

function filterDocumentsForMysqlSync(taskName, documents, context) {
  const syncableDocs = [];
  const skippedDocs = [];

  for (const doc of documents) {
    const reason = getSkipReason(taskName, doc, context);
    if (reason) {
      skippedDocs.push({
        id: toIdString(doc._id),
        reason
      });
      continue;
    }

    syncableDocs.push(doc);
  }

  return {
    syncableDocs,
    skippedDocs
  };
}

module.exports = {
  buildSyncReferenceContext,
  filterDocumentsForMysqlSync,
  getSkipReason,
  toIdString
};
