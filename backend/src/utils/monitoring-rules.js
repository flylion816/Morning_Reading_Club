const TRACKED_API_PREFIXES = [
  '/api/v1/auth',
  '/api/v1/admin',
  '/api/v1/users',
  '/api/v1/periods',
  '/api/v1/sections',
  '/api/v1/checkins',
  '/api/v1/insights',
  '/api/v1/comments',
  '/api/v1/enrollments',
  '/api/v1/payments',
  '/api/v1/ranking',
  '/api/v1/stats',
  '/api/v1/audit-logs',
  '/api/v1/notifications',
  '/api/v1/upload',
  '/api/v1/monitoring',
  '/api/v1/backup',
];

const TRACKED_API_EXACT_PATHS = new Set([
  '/api/v1',
  '/api/v1/health',
  '/api/v1/status',
  '/api/v1/ready',
  '/api/v1/live',
]);

function normalizeEndpoint(endpoint) {
  if (!endpoint) return '';
  return endpoint.split('?')[0].replace(/\/+$/, '') || '/';
}

function isTrackedApiPath(endpoint) {
  const normalizedEndpoint = normalizeEndpoint(endpoint);

  if (TRACKED_API_EXACT_PATHS.has(normalizedEndpoint)) {
    return true;
  }

  return TRACKED_API_PREFIXES.some(prefix => (
    normalizedEndpoint === prefix || normalizedEndpoint.startsWith(`${prefix}/`)
  ));
}

function shouldTrackMetrics(metrics = {}) {
  return isTrackedApiPath(metrics.endpoint);
}

function shouldCountAsError(metrics = {}) {
  if (!shouldTrackMetrics(metrics)) {
    return false;
  }

  return metrics.statusCode >= 400 && metrics.statusCode !== 401;
}

module.exports = {
  TRACKED_API_PREFIXES,
  TRACKED_API_EXACT_PATHS,
  normalizeEndpoint,
  isTrackedApiPath,
  shouldTrackMetrics,
  shouldCountAsError,
};
