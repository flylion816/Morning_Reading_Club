const STORAGE_KEY = 'reading_completion_records';
const MAX_RECORDS = 500;

function normalizeSectionId(section) {
  if (!section) {
    return '';
  }
  if (typeof section === 'string') {
    return section;
  }
  return section._id || section.id || section.sectionId || '';
}

function readRecords() {
  try {
    const records = wx.getStorageSync(STORAGE_KEY) || {};
    return records && typeof records === 'object' && !Array.isArray(records)
      ? records
      : {};
  } catch (error) {
    console.warn('读取阅读完成状态失败:', error);
    return {};
  }
}

function writeRecords(records) {
  try {
    wx.setStorageSync(STORAGE_KEY, records);
    return true;
  } catch (error) {
    console.warn('保存阅读完成状态失败:', error);
    return false;
  }
}

function trimRecords(records) {
  const entries = Object.entries(records || {});
  if (entries.length <= MAX_RECORDS) {
    return records;
  }

  return entries
    .sort(([, a], [, b]) => {
      return Number(b?.completedAt || 0) - Number(a?.completedAt || 0);
    })
    .slice(0, MAX_RECORDS)
    .reduce((nextRecords, [sectionId, record]) => {
      nextRecords[sectionId] = record;
      return nextRecords;
    }, {});
}

function markReadingCompleted(sectionId, options = {}) {
  const normalizedSectionId = normalizeSectionId(sectionId);
  if (!normalizedSectionId) {
    return null;
  }

  const records = readRecords();
  const record = {
    sectionId: normalizedSectionId,
    periodId: options.periodId || '',
    durationMs: Math.max(0, Number(options.durationMs) || 0),
    completedAt: options.completedAt || Date.now()
  };

  records[normalizedSectionId] = record;
  writeRecords(trimRecords(records));
  return record;
}

function getReadingCompletion(sectionId) {
  const normalizedSectionId = normalizeSectionId(sectionId);
  if (!normalizedSectionId) {
    return null;
  }

  return readRecords()[normalizedSectionId] || null;
}

function isReadingCompleted(sectionId) {
  return !!getReadingCompletion(sectionId);
}

function decorateSectionWithReadingCompletion(section = {}) {
  const sectionId = normalizeSectionId(section);
  const readingCompletion = getReadingCompletion(sectionId);
  const serverCompleted = !!section.readingCompleted;
  return {
    ...section,
    readingCompleted: serverCompleted || !!readingCompletion,
    readingCompletedAt:
      section.readingCompletedAt || readingCompletion?.completedAt || null,
    readingDurationMs:
      section.readingDurationMs || readingCompletion?.durationMs || 0
  };
}

function decorateSectionsWithReadingCompletion(sections = []) {
  if (!Array.isArray(sections)) {
    return [];
  }

  return sections.map(decorateSectionWithReadingCompletion);
}

module.exports = {
  STORAGE_KEY,
  normalizeSectionId,
  markReadingCompleted,
  getReadingCompletion,
  isReadingCompleted,
  decorateSectionWithReadingCompletion,
  decorateSectionsWithReadingCompletion
};
