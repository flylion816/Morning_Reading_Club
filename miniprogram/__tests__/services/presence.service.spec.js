const presenceService = require('../../services/presence.service');
const request = require('../../utils/request');

jest.mock('../../utils/request');

describe('presence.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('reportReading posts sectionId silently', async () => {
    request.post.mockResolvedValue({ ok: true });
    await presenceService.reportReading('s1');
    expect(request.post).toHaveBeenCalledWith(
      '/presence/reading',
      { sectionId: 's1' },
      { suppressError: true, suppressAuthError: true }
    );
  });

  test('reportReading swallows errors', async () => {
    request.post.mockRejectedValue(new Error('boom'));
    await expect(presenceService.reportReading('s1')).resolves.toBeNull();
  });

  test('getToday, getMyRank and getPeriodOrigins hit the right paths', async () => {
    request.get.mockResolvedValue({});
    await presenceService.getToday('p1');
    await presenceService.getMyRank('s1', 'reading');
    await presenceService.getPeriodOrigins('p1');
    expect(request.get).toHaveBeenNthCalledWith(1, '/presence/today', { periodId: 'p1' }, { suppressError: true });
    expect(request.get).toHaveBeenNthCalledWith(2, '/presence/my-rank', {
      sectionId: 's1',
      type: 'reading'
    }, { suppressError: true });
    expect(request.get).toHaveBeenNthCalledWith(3, '/presence/period/p1/origins', {}, { suppressError: true });
  });
});
