jest.mock('../../utils/request', () => ({
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn()
}));

const request = require('../../utils/request');
const service = require('../../services/companion-note.service');

describe('companion note service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('uses the protected companion note endpoints', async () => {
    request.get.mockResolvedValue({ list: [] });
    request.post.mockResolvedValue({});
    request.delete.mockResolvedValue({});

    await service.getList({ periodId: 'period_1', page: 1 });
    await service.getSection('section_1');
    await service.getOverview('period_1');
    await service.getOne('note_1');
    await service.getFileTicket('note_1');
    await service.markRead('note_1');
    await service.like('note_1');
    await service.unlike('note_1');
    await service.getComments('note_1', { limit: 20 });
    await service.createComment('note_1', '回响');
    await service.reply('comment_1', '回复', 'user_1');

    expect(request.get).toHaveBeenNthCalledWith(1, '/companion-notes', { periodId: 'period_1', page: 1 }, expect.any(Object));
    expect(request.get).toHaveBeenNthCalledWith(2, '/companion-notes/section/section_1', {}, expect.any(Object));
    expect(request.post).toHaveBeenCalledWith('/companion-notes/note_1/read', {}, expect.any(Object));
    expect(request.post).toHaveBeenCalledWith('/companion-notes/comments/comment_1/replies', { content: '回复', replyToUserId: 'user_1' }, expect.any(Object));
  });

  test('normalizes backend section label objects and derived display fields', () => {
    const note = service.normalizeNote({
      _id: 'note_1',
      title: '慢一点',
      companionName: '青禾',
      periodId: 'period_1',
      sectionLabels: [
        { sectionId: 'section_5', day: 5, title: '双赢思维' },
        { sectionId: 'section_6', day: 6, title: '知彼解己' }
      ],
      file: { pageCount: 7, size: 8400000 },
      likeCount: 12,
      commentCount: 5,
      readerCount: 23
    });

    expect(note).toMatchObject({
      id: 'note_1',
      sectionIds: ['section_5', 'section_6'],
      sectionLabels: ['双赢思维', '知彼解己'],
      sectionDays: [5, 6],
      pageCount: 7,
      fileSize: '8.0 MB',
      likeCount: 12,
      commentCount: 5,
      readerCount: 23
    });
  });
});
