const highlightService = require('../../services/highlight.service');
const request = require('../../utils/request');

jest.mock('../../utils/request');

describe('highlight.service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('addHighlight 提交 sectionId、text、note', () => {
    highlightService.addHighlight('s1', '一句话', '好');
    expect(request.post).toHaveBeenCalledWith('/highlights', {
      sectionId: 's1',
      text: '一句话',
      note: '好'
    });
  });

  test('updateNote / removeHighlight', () => {
    highlightService.updateNote('h1', '新');
    expect(request.put).toHaveBeenCalledWith('/highlights/h1', { note: '新' });
    highlightService.removeHighlight('h1');
    expect(request.delete).toHaveBeenCalledWith('/highlights/h1');
  });

  test('getMine / getSectionPopular', () => {
    highlightService.getMine({ page: 2 });
    expect(request.get).toHaveBeenCalledWith('/highlights/mine', { page: 2 });
    highlightService.getSectionPopular('s1');
    expect(request.get).toHaveBeenCalledWith('/highlights/section/s1/popular', {}, { suppressError: true });
  });
});
