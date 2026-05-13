/* global describe, test, expect */

const {
  buildInsightRequestDisplay,
  extractInsightRequests
} = require('../../utils/insight-request-display');

function createRequest(overrides = {}) {
  return {
    _id: 'request_1',
    status: 'pending',
    createdAt: new Date().toISOString(),
    fromUserId: {
      _id: 'from_user',
      nickname: '申请人',
      avatar: '申',
      avatarUrl: ''
    },
    toUserId: {
      _id: 'to_user',
      nickname: '被申请人',
      avatar: '被',
      avatarUrl: ''
    },
    periodId: {
      _id: 'period_1',
      name: '心流之境'
    },
    insightId: {
      _id: 'insight_1',
      day: 7,
      title: '第7天 反馈'
    },
    ...overrides
  };
}

describe('insight request display utility', () => {
  test('received pending request should use recipient action text', () => {
    const display = buildInsightRequestDisplay(createRequest(), {
      direction: 'received'
    });

    expect(display.displayUserId).toBe('from_user');
    expect(display.displayUserName).toBe('申请人');
    expect(display.displayUserRoleText).toBe('来自');
    expect(display.statusText).toBe('待处理');
    expect(display.canApprove).toBe(true);
    expect(display.canReject).toBe(true);
    expect(display.canNavigate).toBe(true);
  });

  test('sent pending request should use sender status text and stay read-only', () => {
    const display = buildInsightRequestDisplay(createRequest(), {
      direction: 'sent'
    });

    expect(display.displayUserId).toBe('to_user');
    expect(display.displayUserName).toBe('被申请人');
    expect(display.displayUserRoleText).toBe('发给');
    expect(display.statusText).toBe('等待中');
    expect(display.canApprove).toBe(false);
    expect(display.canReject).toBe(false);
    expect(display.canNavigate).toBe(false);
  });

  test.each([
    ['approved', '已同意', 'approved', true],
    ['rejected', '已拒绝', 'rejected', false],
    ['revoked', '已撤销', 'revoked', false]
  ])(
    'sent %s request should format status consistently',
    (status, text, className, canNavigate) => {
      const display = buildInsightRequestDisplay(createRequest({ status }), {
        direction: 'sent'
      });

      expect(display.statusText).toBe(text);
      expect(display.statusClass).toBe(className);
      expect(display.canApprove).toBe(false);
      expect(display.canReject).toBe(false);
      expect(display.canNavigate).toBe(canNavigate);
    }
  );

  test('extractInsightRequests should support common response shapes', () => {
    const list = [createRequest()];

    expect(extractInsightRequests(list)).toBe(list);
    expect(extractInsightRequests({ data: list })).toBe(list);
    expect(extractInsightRequests({ list })).toBe(list);
    expect(extractInsightRequests({ data: { list } })).toEqual([]);
  });
});
