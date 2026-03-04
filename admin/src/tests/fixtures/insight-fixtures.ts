/**
 * 小凡看见相关的测试数据工厂函数
 * 用于 Admin 项目的单元测试
 */

export interface MockInsight {
  id?: string;
  _id?: string;
  userId: string;
  periodId: string;
  content?: string;
  type?: string;
  likeCount?: number;
  commentCount?: number;
  isPublished?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: unknown;
}

/**
 * 创建小凡看见 Mock 对象
 */
export const createMockInsight = (overrides: Partial<MockInsight> = {}): MockInsight => ({
  id: 'insight-001',
  _id: 'insight-001',
  userId: 'user-001',
  periodId: 'period-001',
  content: '今天的晨读让我收获很大，对自我提升有了新的认识和想法。',
  type: 'text',
  likeCount: 5,
  commentCount: 2,
  isPublished: true,
  createdAt: new Date('2025-02-25'),
  updatedAt: new Date('2025-02-25'),
  ...overrides
});

/**
 * 创建多个小凡看见
 */
export const createMockInsights = (count = 5, overrides: Partial<MockInsight> = {}): MockInsight[] =>
  Array.from({ length: count }, (_, i) =>
    createMockInsight({
      id: `insight-${String(i + 1).padStart(3, '0')}`,
      _id: `insight-${String(i + 1).padStart(3, '0')}`,
      userId: `user-${String(i + 1).padStart(3, '0')}`,
      content: `晨读感悟${i + 1}：这是一个关于个人成长的深刻思考。`,
      likeCount: 5 + i,  // 确定性值：递增的点赞数
      commentCount: 2 + Math.floor(i / 2),  // 确定性值：递增的评论数
      createdAt: new Date(2025, 1, 20 + i),
      ...overrides
    })
  );

/**
 * 创建未发布的小凡看见
 */
export const createMockUnpublishedInsight = (overrides: Partial<MockInsight> = {}): MockInsight =>
  createMockInsight({
    isPublished: false,
    ...overrides
  });

/**
 * 创建热门的小凡看见（较多点赞和评论）
 */
export const createMockPopularInsight = (overrides: Partial<MockInsight> = {}): MockInsight =>
  createMockInsight({
    likeCount: 50,
    commentCount: 15,
    ...overrides
  });

/**
 * 创建带图片的小凡看见
 */
export const createMockImageInsight = (overrides: Partial<MockInsight> = {}): MockInsight =>
  createMockInsight({
    type: 'image',
    content: '【晨读分享】\n今天的晨读让我深有感触...',
    ...overrides
  });

/**
 * 创建带视频的小凡看见
 */
export const createMockVideoInsight = (overrides: Partial<MockInsight> = {}): MockInsight =>
  createMockInsight({
    type: 'video',
    content: '【晨读视频分享】',
    ...overrides
  });

/**
 * 创建带链接的小凡看见
 */
export const createMockLinkInsight = (overrides: Partial<MockInsight> = {}): MockInsight =>
  createMockInsight({
    type: 'link',
    content: '分享一篇关于个人提升的文章 https://example.com/article',
    ...overrides
  });

/**
 * 创建无点赞的小凡看见
 */
export const createMockUnlikedInsight = (overrides: Partial<MockInsight> = {}): MockInsight =>
  createMockInsight({
    likeCount: 0,
    commentCount: 0,
    ...overrides
  });
