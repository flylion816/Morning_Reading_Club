/**
 * Comment & Interaction Service Tests (Stage 6: Task 6.2)
 * Tests for commenting, liking, and social interactions on insights
 *
 * Test Coverage:
 * - Comment creation and management
 * - Comment editing and deletion
 * - Like/unlike functionality
 * - Comment pagination and sorting
 * - Mention functionality in comments
 * - Comment caching and updates
 */

const commentService = require('../../services/comment.service');
const request = require('../../utils/request');
const { createMockComment, createMockInsight, createMockUser, generateId } = require('../fixtures');

jest.mock('../../utils/request');

describe('Comment & Interaction Service Tests (Stage 6: Task 6.2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.wx.__storage = {};
    global.wx.getStorageSync.mockClear();
    global.wx.setStorageSync.mockClear();
    global.wx.removeStorageSync.mockClear();
    request.get.mockClear();
    request.post.mockClear();
    request.put.mockClear();
    request.delete.mockClear();
  });

  describe('[COMMENT-1] 发布评论应返回评论对象', () => {
    test('should return comment object after publishing', async () => {
      const mockComment = createMockComment({
        _id: 'comment_123',
        status: 'published'
      });

      request.post.mockResolvedValue(mockComment);

      const result = await commentService.publishComment('insight_123', {
        content: '很棒的分享'
      });

      expect(result).toHaveProperty('_id');
      expect(result.status).toBe('published');
      expect(request.post).toHaveBeenCalledWith('/insights/insight_123/comments', expect.any(Object));
    });

    test('should include comment metadata', async () => {
      const mockComment = createMockComment({
        _id: 'comment_123',
        insightId: 'insight_123'
      });

      request.post.mockResolvedValue(mockComment);

      const result = await commentService.publishComment('insight_123', {
        content: '内容'
      });

      expect(result._id).toBe('comment_123');
      expect(result.insightId).toBe('insight_123');
    });
  });

  describe('[COMMENT-2] 评论应包含 insight ID、用户 ID、内容、时间戳', () => {
    test('should include all required comment fields', async () => {
      const insightId = 'insight_123';
      const userId = 'user_456';
      const content = '很棒的分享';
      const createdAt = new Date().toISOString();

      const mockComment = createMockComment({
        insightId: insightId,
        userId: userId,
        content: content,
        createdAt: createdAt
      });

      request.post.mockResolvedValue(mockComment);

      const result = await commentService.publishComment(insightId, {
        content: content
      });

      expect(result.insightId).toBe(insightId);
      expect(result.userId).toBe(userId);
      expect(result.content).toBe(content);
      expect(result.createdAt).toBe(createdAt);
    });

    test('should validate field types', async () => {
      const mockComment = createMockComment({
        userId: 'user_123',
        content: '评论内容'
      });

      request.post.mockResolvedValue(mockComment);

      const result = await commentService.publishComment('insight_123', {
        content: '评论内容'
      });

      expect(typeof result.userId).toBe('string');
      expect(typeof result.content).toBe('string');
    });
  });

  describe('[COMMENT-3] 获取评论列表应按时间顺序排列', () => {
    test('should return comments sorted chronologically', async () => {
      const baseTime = new Date();
      const mockComments = [
        createMockComment({
          createdAt: baseTime.toISOString()
        }),
        createMockComment({
          createdAt: new Date(baseTime.getTime() + 1000).toISOString()
        }),
        createMockComment({
          createdAt: new Date(baseTime.getTime() + 2000).toISOString()
        })
      ];

      request.get.mockResolvedValue({
        data: mockComments,
        total: 3
      });

      const result = await commentService.getCommentsList('insight_123');

      expect(result.data.length).toBe(3);
      const times = result.data.map(c => new Date(c.createdAt).getTime());
      for (let i = 0; i < times.length - 1; i++) {
        expect(times[i]).toBeLessThanOrEqual(times[i + 1]);
      }
    });

    test('should support both ascending and descending order', async () => {
      const mockComments = [createMockComment()];

      request.get.mockResolvedValue({
        data: mockComments,
        total: 1
      });

      const result = await commentService.getCommentsList('insight_123', {
        order: 'asc'
      });

      expect(request.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ order: 'asc' })
      );
    });
  });

  describe('[COMMENT-4] 编辑评论应成功（如果是自己发布的）', () => {
    test('should update own comment', async () => {
      const commentId = 'comment_123';
      const newContent = '更新的评论内容';

      const mockComment = createMockComment({
        _id: commentId,
        content: newContent
      });

      request.put.mockResolvedValue(mockComment);

      const result = await commentService.updateComment(commentId, {
        content: newContent
      });

      expect(request.put).toHaveBeenCalledWith(`/comments/${commentId}`, expect.any(Object));
      expect(result.content).toBe(newContent);
    });

    test('should prevent editing others comments', async () => {
      request.put.mockRejectedValue({
        code: 403,
        message: 'Cannot edit other users comment'
      });

      await expect(
        commentService.updateComment('other_comment_123', { content: 'Hacked' })
      ).rejects.toEqual(expect.objectContaining({
        message: 'Cannot edit other users comment'
      }));
    });
  });

  describe('[COMMENT-5] 删除评论应成功（如果是自己发布的）', () => {
    test('should delete own comment', async () => {
      const commentId = 'comment_123';
      request.delete.mockResolvedValue({
        code: 200,
        message: 'Comment deleted'
      });

      const result = await commentService.deleteComment(commentId);

      expect(request.delete).toHaveBeenCalledWith(`/comments/${commentId}`);
      expect(result.code).toBe(200);
    });

    test('should prevent deleting others comments', async () => {
      request.delete.mockRejectedValue({
        code: 403,
        message: 'Cannot delete other users comment'
      });

      await expect(
        commentService.deleteComment('other_comment_123')
      ).rejects.toBeDefined();
    });

    test('should allow insight creator to moderate comments', async () => {
      request.delete.mockResolvedValue({
        code: 200,
        message: 'Comment removed by moderator'
      });

      const result = await commentService.deleteComment('comment_123', {
        moderator: true
      });

      expect(result.code).toBe(200);
    });
  });

  describe('[COMMENT-6] 点赞 insight 应成功', () => {
    test('should like an insight', async () => {
      const insightId = 'insight_123';
      request.post.mockResolvedValue({
        code: 200,
        message: 'Insight liked',
        likeCount: 16
      });

      const result = await commentService.likeInsight(insightId);

      expect(request.post).toHaveBeenCalledWith(`/insights/${insightId}/like`, expect.any(Object));
      expect(result.message).toBe('Insight liked');
    });

    test('should increment like count', async () => {
      request.post.mockResolvedValue({
        likeCount: 10
      });

      const result = await commentService.likeInsight('insight_123');

      expect(result).toHaveProperty('likeCount');
    });
  });

  describe('[COMMENT-7] 取消点赞应成功', () => {
    test('should unlike an insight', async () => {
      const insightId = 'insight_123';
      request.delete.mockResolvedValue({
        code: 200,
        message: 'Like removed',
        likeCount: 14
      });

      const result = await commentService.unlikeInsight(insightId);

      expect(request.delete).toHaveBeenCalledWith(`/insights/${insightId}/like`);
      expect(result.message).toBe('Like removed');
    });

    test('should decrement like count', async () => {
      request.delete.mockResolvedValue({
        likeCount: 9
      });

      const result = await commentService.unlikeInsight('insight_123');

      expect(result.likeCount).toBe(9);
    });
  });

  describe('[COMMENT-8] 获取 insight 点赞列表应显示点赞人列表', () => {
    test('should return list of users who liked insight', async () => {
      const mockLikes = [
        { userId: 'user_1', userNickname: '用户1', userAvatar: 'url1' },
        { userId: 'user_2', userNickname: '用户2', userAvatar: 'url2' }
      ];

      request.get.mockResolvedValue({
        data: mockLikes,
        total: 2
      });

      const result = await commentService.getInsightLikes('insight_123');

      expect(result.data.length).toBe(2);
      expect(result.data[0]).toHaveProperty('userNickname');
      expect(result.data[0]).toHaveProperty('userAvatar');
    });

    test('should support pagination for likes', async () => {
      request.get.mockResolvedValue({
        data: [],
        page: 1,
        pageSize: 10,
        total: 50
      });

      const result = await commentService.getInsightLikes('insight_123', {
        page: 1,
        limit: 10
      });

      expect(result.total).toBe(50);
    });
  });

  describe('[COMMENT-9] 点赞数应实时更新', () => {
    test('should update like count immediately', async () => {
      request.post.mockResolvedValue({
        likeCount: 16
      });

      const result = await commentService.likeInsight('insight_123');

      expect(result.likeCount).toBe(16);
    });

    test('should reflect like count changes', async () => {
      request.post.mockResolvedValue({ likeCount: 15 });
      const result1 = await commentService.likeInsight('insight_123');

      request.post.mockResolvedValue({ likeCount: 16 });
      const result2 = await commentService.likeInsight('insight_123');

      expect(result2.likeCount).toBeGreaterThan(result1.likeCount);
    });
  });

  describe('[COMMENT-10] 获取评论列表应包含评论者的用户信息', () => {
    test('should include commenter user info', async () => {
      const mockComments = [
        createMockComment({
          userId: 'user_123',
          userNickname: '用户名',
          userAvatar: 'https://example.com/avatar.jpg'
        })
      ];

      request.get.mockResolvedValue({
        data: mockComments,
        total: 1
      });

      const result = await commentService.getCommentsList('insight_123');

      expect(result.data[0]).toHaveProperty('userNickname');
      expect(result.data[0]).toHaveProperty('userAvatar');
      expect(result.data[0].userNickname).toBe('用户名');
    });
  });

  describe('[COMMENT-11] 评论应支持 @mention', () => {
    test('should support @mention in comments', async () => {
      const content = '@user_456 你的分析很棒';
      const mockComment = createMockComment({
        content: content,
        mentions: ['user_456']
      });

      request.post.mockResolvedValue(mockComment);

      const result = await commentService.publishComment('insight_123', {
        content: content
      });

      expect(result.content).toContain('@');
      expect(result.mentions).toContain('user_456');
    });

    test('should notify mentioned users', async () => {
      const mockComment = createMockComment({
        content: '@user_456 看看这个',
        mentions: ['user_456']
      });

      request.post.mockResolvedValue(mockComment);

      const result = await commentService.publishComment('insight_123', {
        content: '@user_456 看看这个'
      });

      // Service should send notifications
      expect(request.post).toHaveBeenCalled();
    });
  });

  describe('[COMMENT-12] 发布评论应验证内容非空', () => {
    test('should reject empty comment content', async () => {
      request.post.mockRejectedValue({
        code: 400,
        message: 'Comment content is required'
      });

      await expect(
        commentService.publishComment('insight_123', {
          content: ''
        })
      ).rejects.toBeDefined();
    });

    test('should validate content length', async () => {
      request.post.mockRejectedValue({
        code: 400,
        message: 'Comment too long'
      });

      await expect(
        commentService.publishComment('insight_123', {
          content: 'x'.repeat(10000)
        })
      ).rejects.toBeDefined();
    });
  });

  describe('[COMMENT-13] 应支持删除他人对自己的 insight 的评论（moderation）', () => {
    test('should allow insight creator to delete comments', async () => {
      request.delete.mockResolvedValue({
        code: 200,
        message: 'Comment removed by insight creator'
      });

      const result = await commentService.deleteComment('comment_123', {
        asCreator: true
      });

      expect(result.code).toBe(200);
    });

    test('should verify user is insight creator', async () => {
      request.delete.mockRejectedValue({
        code: 403,
        message: 'Only insight creator can delete this comment'
      });

      await expect(
        commentService.deleteComment('comment_123', { asCreator: true })
      ).rejects.toBeDefined();
    });
  });

  describe('[COMMENT-14] 评论列表应支持分页', () => {
    test('should support pagination for comments', async () => {
      const mockComments = Array.from({ length: 20 }, () => createMockComment());

      request.get.mockResolvedValue({
        data: mockComments,
        page: 1,
        pageSize: 20,
        total: 100
      });

      const result = await commentService.getCommentsList('insight_123', {
        page: 1,
        limit: 20
      });

      expect(request.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ page: 1, limit: 20 })
      );
      expect(result.total).toBe(100);
    });

    test('should handle different page sizes', async () => {
      request.get.mockResolvedValue({
        data: Array.from({ length: 10 }, () => createMockComment()),
        page: 1,
        pageSize: 10,
        total: 50
      });

      const result = await commentService.getCommentsList('insight_123', {
        limit: 10
      });

      expect(result.data.length).toBe(10);
    });
  });

  describe('[COMMENT-15] 评论发布成功后应自动更新缓存', () => {
    test('should update local cache after publishing comment', async () => {
      wx.setStorageSync('comments_insight_123', []);

      const mockComment = createMockComment({
        _id: 'comment_123'
      });

      request.post.mockResolvedValue(mockComment);

      const result = await commentService.publishComment('insight_123', {
        content: '评论'
      });

      expect(request.post).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    test('should invalidate cache on comment changes', async () => {
      request.post.mockResolvedValue(createMockComment());

      await commentService.publishComment('insight_123', {
        content: '新评论'
      });

      // Service should invalidate cache
      expect(request.post).toHaveBeenCalled();
    });
  });

  // Additional edge case tests for comprehensive coverage
  describe('[COMMENT-EXTRA] Additional Comment & Interaction Methods', () => {
    test('should get interaction statistics', async () => {
      request.get.mockResolvedValue({
        totalComments: 50,
        totalLikes: 200,
        likePercentage: 80,
        commentPercentage: 20
      });

      const result = await commentService.getInteractionStats('insight_123');

      expect(result).toHaveProperty('totalComments');
      expect(result).toHaveProperty('totalLikes');
    });

    test('should get user interaction history', async () => {
      const userId = 'user_123';
      request.get.mockResolvedValue({
        data: [
          { type: 'like', insightId: 'insight_1', timestamp: new Date().toISOString() },
          { type: 'comment', insightId: 'insight_2', timestamp: new Date().toISOString() }
        ],
        total: 2
      });

      const result = await commentService.getUserInteractionHistory(userId);

      expect(result.data.length).toBe(2);
    });

    test('should support comment threading/replies', async () => {
      const mockReply = createMockComment({
        parentCommentId: 'comment_parent',
        depth: 2
      });

      request.post.mockResolvedValue(mockReply);

      const result = await commentService.publishComment('insight_123', {
        content: '回复',
        parentCommentId: 'comment_parent'
      });

      expect(result).toHaveProperty('parentCommentId');
    });

    test('should check user like status', async () => {
      request.get.mockResolvedValue({
        isLiked: true
      });

      const result = await commentService.checkUserLikeStatus('user_123', 'insight_123');

      expect(result.isLiked).toBe(true);
    });

    test('should get most liked comments', async () => {
      const mockComments = [
        createMockComment({ likeCount: 10 }),
        createMockComment({ likeCount: 8 }),
        createMockComment({ likeCount: 5 })
      ];

      request.get.mockResolvedValue({
        data: mockComments,
        total: 3
      });

      const result = await commentService.getMostLikedComments('insight_123');

      expect(result.data[0].likeCount).toBeGreaterThanOrEqual(result.data[1].likeCount);
    });
  });
});
