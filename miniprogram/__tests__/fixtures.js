/**
 * Test Fixtures - Factory Pattern Data Generators
 * Provides factory functions to generate realistic mock data for all test suites
 */

/**
 * Generate deterministic unique ID using counter
 * Falls back to timestamp-based ID if counter not available
 * @returns {string} Unique ID like "id-12345" or "507f1f77bcf86cd799439011"
 */
function generateId() {
  // Use counter-based ID if available (in tests)
  if (typeof global.__idCounter !== 'undefined') {
    return `id_${global.__idCounter++}`;
  }
  // Fallback to timestamp-based ID (for non-test usage)
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Create mock user data
 * @param {Object} overrides - Optional field overrides
 * @returns {Object} Mock user object
 */
function createMockUser(overrides = {}) {
  const defaults = {
    _id: generateId(),
    openid: `openid_${generateId().substring(0, 8)}`,
    nickname: `用户${Math.floor(Math.random() * 10000)}`,
    avatar: 'https://example.com/avatar.jpg',
    email: `user${Math.floor(Math.random() * 10000)}@example.com`,
    phone: `1${Math.floor(Math.random() * 9) + 1}${Math.floor(Math.random() * 10000000000)}`.substring(0, 11),
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return { ...defaults, ...overrides };
}

/**
 * Create mock period data
 * @param {Object} overrides - Optional field overrides
 * @returns {Object} Mock period object
 */
function createMockPeriod(overrides = {}) {
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days later

  const defaults = {
    _id: generateId(),
    name: `晨读营第${Math.floor(Math.random() * 100)}期`,
    description: '在晨光中，遇见更好的自己',
    status: 'active',
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    enrollmentStartDate: new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    enrollmentEndDate: startDate.toISOString(),
    price: 99.00,
    maxEnrollment: 100,
    currentEnrollment: Math.floor(Math.random() * 50),
    instructor: {
      _id: generateId(),
      nickname: '晨读营讲师',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return { ...defaults, ...overrides };
}

/**
 * Create mock course data
 * @param {Object} overrides - Optional field overrides
 * @returns {Object} Mock course object
 */
function createMockCourse(overrides = {}) {
  const defaults = {
    _id: generateId(),
    periodId: generateId(),
    dayOfPeriod: Math.floor(Math.random() * 30) + 1,
    title: `成功来自于专注与坚持`,
    description: '今天分享成功的秘诀',
    content: '## 成功的三个要素\n1. 专注\n2. 坚持\n3. 反思',
    status: 'published',
    checkinsCount: Math.floor(Math.random() * 50),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return { ...defaults, ...overrides };
}

/**
 * Create mock enrollment record
 * @param {Object} overrides - Optional field overrides
 * @returns {Object} Mock enrollment object
 */
function createMockEnrollment(overrides = {}) {
  const defaults = {
    _id: generateId(),
    userId: generateId(),
    periodId: generateId(),
    status: 'active',
    enrollmentDate: new Date().toISOString(),
    paymentStatus: 'completed',
    paymentMethod: 'wechat',
    amount: 99.00,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return { ...defaults, ...overrides };
}

/**
 * Create mock checkin/attendance record
 * @param {Object} overrides - Optional field overrides
 * @returns {Object} Mock checkin object
 */
function createMockCheckin(overrides = {}) {
  const defaults = {
    _id: generateId(),
    userId: generateId(),
    periodId: generateId(),
    courseId: generateId(),
    checkinDate: new Date().toISOString(),
    checkinTime: new Date().toISOString(),
    durationMinutes: Math.floor(Math.random() * 120) + 5,
    status: 'completed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return { ...defaults, ...overrides };
}

/**
 * Create mock "小凡看见" (insight) social record
 * @param {Object} overrides - Optional field overrides
 * @returns {Object} Mock insight object
 */
function createMockInsight(overrides = {}) {
  const defaults = {
    _id: generateId(),
    creatorUserId: generateId(),
    targetUserId: generateId(),
    periodId: generateId(),
    title: `我看见你${Math.floor(Math.random() * 1000)}`,
    content: '你今天表现得非常棒！',
    imageUrl: 'https://example.com/image.jpg',
    likeCount: Math.floor(Math.random() * 100),
    commentCount: Math.floor(Math.random() * 20),
    isLiked: false,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return { ...defaults, ...overrides };
}

/**
 * Create mock payment transaction record
 * @param {Object} overrides - Optional field overrides
 * @returns {Object} Mock payment object
 */
function createMockPayment(overrides = {}) {
  const defaults = {
    _id: generateId(),
    userId: generateId(),
    periodId: generateId(),
    orderId: `order_${generateId().substring(0, 8)}`,
    amount: 99.00,
    currency: 'CNY',
    paymentMethod: 'wechat',
    status: 'completed',
    transactionId: `txn_${generateId().substring(0, 12)}`,
    paymentDate: new Date().toISOString(),
    completionDate: new Date().toISOString(),
    refundStatus: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return { ...defaults, ...overrides };
}

/**
 * Create mock ranking list entry
 * @param {Object} overrides - Optional field overrides
 * @returns {Object} Mock ranking item object
 */
function createMockRankingItem(overrides = {}) {
  const defaults = {
    _id: generateId(),
    userId: generateId(),
    userNickname: `用户${Math.floor(Math.random() * 10000)}`,
    userAvatar: 'https://example.com/avatar.jpg',
    periodId: generateId(),
    score: Math.floor(Math.random() * 1000),
    checkinCount: Math.floor(Math.random() * 30),
    insightCount: Math.floor(Math.random() * 20),
    likeCount: Math.floor(Math.random() * 100),
    rank: Math.floor(Math.random() * 100) + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return { ...defaults, ...overrides };
}

/**
 * Create mock comment data
 * @param {Object} overrides - Optional field overrides
 * @returns {Object} Mock comment object
 */
function createMockComment(overrides = {}) {
  const defaults = {
    _id: generateId(),
    insightId: generateId(),
    userId: generateId(),
    userNickname: `用户${Math.floor(Math.random() * 10000)}`,
    userAvatar: 'https://example.com/avatar.jpg',
    content: '这是一条评论',
    likeCount: Math.floor(Math.random() * 50),
    isLiked: false,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return { ...defaults, ...overrides };
}

// Export all factory functions
module.exports = {
  generateId,
  createMockUser,
  createMockPeriod,
  createMockCourse,
  createMockEnrollment,
  createMockCheckin,
  createMockInsight,
  createMockPayment,
  createMockRankingItem,
  createMockComment,
};
