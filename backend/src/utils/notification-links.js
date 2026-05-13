function buildCourseDetailTargetPage(sectionId, params = {}) {
  const search = new URLSearchParams();

  search.set('id', String(sectionId));

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  });

  return `pages/course-detail/course-detail?${search.toString()}`;
}

function buildProfileOthersTargetPage(userId, params = {}) {
  const search = new URLSearchParams();

  search.set('userId', String(userId));

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  });

  return `pages/profile-others/profile-others?${search.toString()}`;
}

function buildInsightDetailTargetPage(insightId, params = {}) {
  const search = new URLSearchParams();

  search.set('id', String(insightId));

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  });

  return `pages/insight-detail/insight-detail?${search.toString()}`;
}

function buildInsightsListTargetPage(params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  });

  const query = search.toString();
  return query ? `pages/insights/insights?${query}` : 'pages/insights/insights';
}

function buildInsightApprovalTargetPage({
  insightId = null,
  requestId = null,
  targetUserId = null,
  periodId = null,
  from = 'service_notice'
} = {}) {
  const params = {
    from,
    requestId
  };

  if (insightId) {
    return buildInsightDetailTargetPage(insightId, params);
  }

  return buildInsightsListTargetPage({
    userId: targetUserId,
    periodId,
    ...params
  });
}

function formatNotificationTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function truncateText(text, maxLength = 24) {
  const normalized = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return '';
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

module.exports = {
  buildCourseDetailTargetPage,
  buildInsightApprovalTargetPage,
  buildInsightDetailTargetPage,
  buildInsightsListTargetPage,
  buildProfileOthersTargetPage,
  formatNotificationTime,
  truncateText
};
