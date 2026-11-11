const seenCardService = require('../../services/seen-card.service');
const request = require('../../utils/request');

jest.mock('../../utils/request');

describe('seen-card service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    request.get.mockResolvedValue({});
    request.put.mockResolvedValue({});
    request.post.mockResolvedValue({});
    request.delete.mockResolvedValue({});
  });

  test('sendSeen PUTs the phrase key', async () => {
    await seenCardService.sendSeen('c1', 'persist');
    expect(request.put).toHaveBeenCalledWith('/seen-cards/checkin/c1', { phrase: 'persist' });
  });

  test('withdrawSeen DELETEs own card', async () => {
    await seenCardService.withdrawSeen('c1');
    expect(request.delete).toHaveBeenCalledWith('/seen-cards/checkin/c1');
  });

  test('getCheckinSeen GETs the summary', async () => {
    await seenCardService.getCheckinSeen('c1');
    expect(request.get).toHaveBeenCalledWith('/seen-cards/checkin/c1', {}, { suppressError: true });
  });

  test('getSummary POSTs checkin ids', async () => {
    await seenCardService.getSummary(['a', 'b']);
    expect(request.post).toHaveBeenCalledWith('/seen-cards/checkins/summary', { checkinIds: ['a', 'b'] }, { suppressError: true });
  });

  test('getReceived passes paging params', async () => {
    await seenCardService.getReceived({ page: 2, limit: 20 });
    expect(request.get).toHaveBeenCalledWith('/seen-cards/received', { page: 2, limit: 20 });
  });
});
