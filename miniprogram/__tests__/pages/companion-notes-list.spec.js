describe('companion notes list helpers', () => {
  let pageConfig;

  beforeEach(() => {
    jest.resetModules();
    pageConfig = null;
    global.Page = jest.fn(config => {
      pageConfig = config;
      return config;
    });
    require('../../pages/companion-notes/list/list');
  });

  afterEach(() => {
    delete global.Page;
  });

  test('groups multi-section notes once under their earliest lesson', () => {
    const notes = [
      {
        id: 'note_1',
        title: '一起赢',
        sectionIds: ['s5', 's6'],
        sectionDays: [5, 6],
        sectionLabels: ['双赢思维', '知彼解己'],
        lessonLabel: '第 5–6 课',
        sortOrder: 1
      },
      {
        id: 'note_2',
        title: '先理解',
        sectionIds: ['s5'],
        sectionDays: [5],
        sectionLabels: ['双赢思维'],
        lessonLabel: '第 5 课',
        sortOrder: 0
      }
    ];

    const groups = pageConfig.buildNoteGroups(notes);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('第 5–6 课');
    expect(groups[0].items.map(item => item.id)).toEqual(['note_2', 'note_1']);
  });

  test('builds a trail with read, unread and empty lesson states', () => {
    const trail = pageConfig.buildTrail({}, [
      { id: 'note_1', sectionDays: [1], isRead: true },
      { id: 'note_2', sectionDays: [3], isRead: false }
    ]);

    expect(trail).toEqual([
      expect.objectContaining({ day: 1, hasNotes: true, isRead: true }),
      expect.objectContaining({ day: 3, hasNotes: true, isRead: false })
    ]);
  });

  test('keeps the all-camp tab available after period tabs', () => {
    expect(pageConfig.buildPeriodTabs([
      { _id: 'p2', title: '第 12 期' },
      { _id: 'p2', title: '重复期次' }
    ], 'p2', '')).toEqual([
      { id: 'p2', name: '第 12 期', scope: 'period', active: true },
      { id: '', name: '全营', scope: 'general', active: false }
    ]);
  });
});
