const mongoose = require('mongoose');
const CompanionNote = require('../models/CompanionNote');
const Section = require('../models/Section');
const { findCommunityEnrollment, getCommunityAccessiblePeriodIds } = require('./community-access.service');

const PUBLISHED_NOTE_FILTER = Object.freeze({ status: 'published', deletedAt: null });

function idString(value) {
  return value && value.toString ? value.toString() : String(value || '');
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

async function accessiblePeriodIds(userId) {
  return getCommunityAccessiblePeriodIds(userId);
}

async function hasPeriodCommunityAccess(userId, periodId) {
  if (!userId || !periodId) return false;
  const enrollment = await findCommunityEnrollment(userId, periodId);
  return Boolean(
    enrollment &&
    ['active', 'completed'].includes(enrollment.status) &&
    ['paid', 'free'].includes(enrollment.paymentStatus)
  );
}

async function hasAnyCommunityAccess(userId) {
  const periodIds = await accessiblePeriodIds(userId);
  return periodIds.length > 0;
}

async function canAccessNote(note, userId) {
  if (!note || note.status !== 'published' || note.deletedAt) return false;
  if (note.periodId) return hasPeriodCommunityAccess(userId, note.periodId);
  return hasAnyCommunityAccess(userId);
}

async function loadAccessibleNote(noteId, userId, { lean = false } = {}) {
  if (!isValidObjectId(noteId)) return null;
  const note = await CompanionNote.findOne({ _id: noteId, ...PUBLISHED_NOTE_FILTER });
  if (!note || !(await canAccessNote(note, userId))) return null;
  if (lean) return note.toObject ? note.toObject() : note;
  return note;
}

/**
 * Build a server-side visibility filter for list queries. A null return means
 * the user has no valid enrollment and should not cause a database query.
 */
async function buildAccessibleNoteFilter(userId, { periodId, scope } = {}) {
  const periodIds = await accessiblePeriodIds(userId);
  if (!periodIds.length) return null;

  const filter = { ...PUBLISHED_NOTE_FILTER };
  if (scope === 'general' || periodId === null || periodId === 'general') {
    filter.periodId = null;
    return filter;
  }

  if (periodId !== undefined && periodId !== null && periodId !== '') {
    if (!isValidObjectId(periodId)) return null;
    const allowed = periodIds.some(id => idString(id) === idString(periodId));
    if (!allowed) return null;
    filter.periodId = periodId;
    return filter;
  }

  filter.$or = [
    { periodId: { $in: periodIds } },
    { periodId: null }
  ];
  return filter;
}

async function getPublishedSections(sectionIds = []) {
  const ids = sectionIds.filter(isValidObjectId);
  if (!ids.length) return [];
  return Section.find({ _id: { $in: ids }, isPublished: true })
    .select('_id periodId day title')
    .sort({ day: 1 })
    .lean();
}

function sectionLabelsForNote(note, sections) {
  const sectionMap = new Map(sections.map(section => [idString(section._id), section]));
  const visibleSections = (note.sectionIds || [])
    .map(id => sectionMap.get(idString(id)))
    .filter(Boolean)
    .sort((left, right) => Number(left.day) - Number(right.day));

  return visibleSections.map(section => ({
    sectionId: section._id,
    day: section.day,
    title: section.title
  }));
}

function toPublicNote(note, { sectionLabels = [], ...extra } = {}) {
  const source = note?.toObject ? note.toObject() : { ...(note || {}) };
  const file = source.file || {};
  delete source.createdBy;
  delete source.updatedBy;
  delete source.deletedAt;
  delete source.tenantId;
  delete source.file;
  return {
    ...source,
    file: {
      originalName: file.originalName || '',
      size: file.size || 0,
      pageCount: file.pageCount || 0,
      pagesReady: Boolean(file.pagesReady),
      uploadedAt: file.uploadedAt || null
    },
    sectionLabels,
    ...extra
  };
}

module.exports = {
  PUBLISHED_NOTE_FILTER,
  idString,
  isValidObjectId,
  accessiblePeriodIds,
  hasPeriodCommunityAccess,
  hasAnyCommunityAccess,
  canAccessNote,
  loadAccessibleNote,
  buildAccessibleNoteFilter,
  getPublishedSections,
  sectionLabelsForNote,
  toPublicNote
};
