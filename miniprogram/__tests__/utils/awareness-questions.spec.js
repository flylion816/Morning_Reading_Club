const q = require('../../utils/awareness-questions');

// 某种心情下，一个习惯能换到的每一条问题链（问题里的词已经换好）
const laddersOf = (key, tone, context = {}) =>
  Array.from({ length: q.ladderCount(key, tone) }, (_, variant) => q.pickLadder(key, variant, { tone, ...context }));

describe('觉察日记题库', () => {
  test('八组：七个习惯各一组加通用；每组两条给难受时的问题链、至少一条「种子」问题链，每条三问', () => {
    expect(q.HABIT_KEYS).toEqual(['habit1', 'habit2', 'habit3', 'habit4', 'habit5', 'habit6', 'habit7', 'general']);
    q.HABIT_KEYS.forEach(key => {
      const habit = q.HABITS[key];
      expect(habit.ladders).toHaveLength(2);
      expect(habit.seeds.length).toBeGreaterThanOrEqual(1);
      habit.ladders.concat(habit.seeds).forEach(ladder => expect(ladder).toHaveLength(q.MAX_ASK_LEVEL));
      // 门上的话：既问难受的那一刻，也问心里一亮的那一刻
      expect(habit.doors.length).toBeGreaterThanOrEqual(3);
    });
    expect(q.HABITS.general.seeds).toHaveLength(2);
    expect(q.HABITS.general.doors).toContain('今天有哪一刻，让你心里一亮？');
  });

  test('每一问换进词以后都不超过服务端的 80 字，也不会留下没换掉的占位', () => {
    const longest = '八个字的情绪词啊'; // 服务端允许的情绪词最长 8 个字
    q.HABIT_KEYS.forEach(key => {
      q.TONES.forEach(tone => {
        [{}, { heavyWord: longest, brightWord: longest }].forEach(context => {
          laddersOf(key, tone, context).forEach(({ questions }) => {
            questions.forEach(text => {
              expect(text).not.toMatch(/[{}]/);
              expect(text.length).toBeGreaterThan(5);
              expect(Array.from(text).length).toBeLessThanOrEqual(80);
            });
          });
        });
      });
    });
  });

  test('按课程标题识别习惯：名称、第 N 个习惯、习惯 N（含中文数字和两种叫法）', () => {
    expect(q.detectHabit('积极主动')).toBe('habit1');
    expect(q.detectHabit('主动积极')).toBe('habit1');
    expect(q.detectHabit('第二个习惯：以终为始')).toBe('habit2');
    expect(q.detectHabit('要事第一')).toBe('habit3');
    expect(q.detectHabit('双赢思维')).toBe('habit4');
    expect(q.detectHabit('第五个习惯')).toBe('habit5');
    expect(q.detectHabit('第 5 个习惯')).toBe('habit5');
    expect(q.detectHabit('习惯六')).toBe('habit6');
    expect(q.detectHabit('习惯 7')).toBe('habit7');
    expect(q.detectHabit('知彼解己')).toBe('habit5');
    expect(q.detectHabit('统合综效')).toBe('habit6');
    expect(q.detectHabit('不断更新')).toBe('habit7');
  });

  test('「七个习惯晨读营」这样的期次名不会被当成第七个习惯，识别不出时用通用', () => {
    expect(q.detectHabit('七个习惯晨读营')).toBe('general');
    expect(q.detectHabit('习惯养成营第 12 期')).toBe('general');
    expect(q.detectHabit('品德成功论')).toBe('general');
    expect(q.detectHabit('', null, undefined)).toBe('general');
    expect(q.detectHabit()).toBe('general');
  });

  test('多个标题时取第一个能识别的', () => {
    expect(q.detectHabit('开篇', '第三个习惯')).toBe('habit3');
    expect(q.detectHabit('七个习惯晨读营', '知彼解己')).toBe('habit5');
  });

  test('习惯名称：通用组没有名称', () => {
    expect(q.habitName('habit5')).toBe('知彼解己');
    expect(q.habitName('general')).toBe('');
    expect(q.habitName('nope')).toBe('');
  });

  test('门上的那句话：同一天固定，隔天可以换，没有习惯时只用通用组', () => {
    const a = q.pickDoorLine('habit5', '2026-11-16');
    expect(q.pickDoorLine('habit5', '2026-11-16')).toBe(a);
    const days = Array.from({ length: 14 }, (_, n) => q.pickDoorLine('habit5', `2026-11-${10 + n}`));
    expect(new Set(days).size).toBeGreaterThan(1);
    const pool = q.HABITS.habit5.doors.concat(q.HABITS.general.doors);
    days.forEach(line => expect(pool).toContain(line));
    const general = Array.from({ length: 14 }, (_, n) => q.pickDoorLine('general', `2026-11-${10 + n}`));
    general.forEach(line => expect(q.HABITS.general.doors).toContain(line));
    expect(q.HABITS.general.doors).toContain(q.pickDoorLine('???', '2026-11-16'));
  });

  test('问题链：不带心情时和以前一样，在两条之间循环；不认识的习惯用通用', () => {
    const first = q.getLadder('habit5', 0);
    const second = q.getLadder('habit5', 1);
    expect(first).toEqual(q.HABITS.habit5.ladders[0]);
    expect(first).not.toEqual(second);
    expect(q.getLadder('habit5', 2)).toEqual(first);
    expect(q.getLadder('habit5', -1)).toEqual(second);
    expect(q.getLadder('nope')).toEqual(q.getLadder('general', 0));
    expect(q.ladderCount('habit1')).toBe(2);
    // 返回副本，改它不影响题库
    first[0] = '改过';
    expect(q.getLadder('habit5', 0)[0]).not.toBe('改过');
  });

  describe('心情的两面：开心和难过的背后，都藏着在意的东西', () => {
    test('情绪词：沉一点的、亮一点的各八个，不重复，都在服务端允许的长度内', () => {
      expect(q.HEAVY_FEELINGS).toHaveLength(8);
      expect(q.BRIGHT_FEELINGS).toHaveLength(8);
      expect(q.FEELINGS).toEqual(q.HEAVY_FEELINGS.concat(q.BRIGHT_FEELINGS));
      expect(new Set(q.FEELINGS).size).toBe(16);
      expect(q.FEELING_GROUPS.map(group => group.label)).toEqual(['沉一点的', '亮一点的']);
      expect(q.FEELING_GROUPS.map(group => group.words)).toEqual([q.HEAVY_FEELINGS, q.BRIGHT_FEELINGS]);
      expect(q.BRIGHT_FEELINGS).toEqual(expect.arrayContaining(['开心', '感动', '感恩', '平静']));
      q.FEELINGS.concat(q.BODY_AREAS).forEach(word => expect(Array.from(word).length).toBeLessThanOrEqual(8));
      expect(q.MAX_FEELINGS).toBe(3);
    });

    test('看明暗：只选亮的、只选沉的、两种都有、没选；不认识的词不算', () => {
      expect(q.ladderContext(['感动', '开心'])).toEqual({ tone: 'bright', heavyWord: '', brightWord: '感动' });
      expect(q.ladderContext(['委屈', '着急'])).toEqual({ tone: 'heavy', heavyWord: '委屈', brightWord: '' });
      expect(q.ladderContext(['感动', '内疚'])).toEqual({ tone: 'mixed', heavyWord: '内疚', brightWord: '感动' });
      expect(q.ladderContext([])).toEqual({ tone: 'none', heavyWord: '', brightWord: '' });
      expect(q.ladderContext(['欢喜'])).toEqual({ tone: 'none', heavyWord: '', brightWord: '' });
      expect(q.ladderContext(undefined).tone).toBe('none');
    });

    test('只选了亮的：先给这个习惯的种子问题，再是通用的两条；问题里带上这个词', () => {
      const context = q.ladderContext(['感动']);
      expect(q.ladderCount('habit5', 'bright')).toBe(3);
      expect(q.ladderCount('general', 'bright')).toBe(2);
      const own = q.pickLadder('habit5', 0, context);
      expect(own.kind).toBe('seed');
      expect(own.questions[0]).toBe('这份感动里，有没有一次「被听懂」，或者「听懂了别人」？');
      expect(q.pickLadder('habit5', 1, context).questions).toEqual([
        '这份感动，是从哪一刻开始的？',
        '为什么偏偏是这件事？它碰到了我心里在意的什么？',
        '这份在意，是我心里的哪一颗种子？'
      ]);
      expect(q.pickLadder('habit5', 2, context).questions[0]).toBe('这份感动里，我最想记住哪一个画面？');
      expect(q.pickLadder('habit5', 3, context)).toEqual(own);
    });

    test('只选了沉的：用原来的问题链，通用那条的最后一问带上这个词；没有词时说「这份情绪」', () => {
      expect(q.pickLadder('general', 0, q.ladderContext(['委屈']))).toEqual({
        kind: 'heavy',
        questions: ['那一刻，我最在意的是什么？', '我在保护什么，或者害怕失去什么？', '如果不被这份委屈推着走，我真正想要的是什么？']
      });
      expect(q.ladderCount('habit3', 'heavy')).toBe(2);
      expect(q.getLadder('general', 0)[2]).toBe('如果不被这份情绪推着走，我真正想要的是什么？');
    });

    test('两种都有或没选：先给沉的，「换一问」能换到种子；没选时种子问题说「这份好心情」', () => {
      const mixed = q.ladderContext(['感动', '内疚']);
      expect(q.ladderCount('habit5', 'mixed')).toBe(5);
      expect(q.ladderCount('general', 'none')).toBe(4);
      expect(q.pickLadder('habit5', 0, mixed).kind).toBe('heavy');
      expect(q.pickLadder('habit5', 1, mixed).kind).toBe('heavy');
      const seed = q.pickLadder('habit5', 2, mixed);
      expect(seed.kind).toBe('seed');
      expect(seed.questions[0]).toContain('这份感动');
      expect(q.pickLadder('general', 2, q.ladderContext([])).questions[0]).toBe('这份好心情，是从哪一刻开始的？');
    });

    test('「问」的引子、「择」的问题和「收」的那句话，跟着问题链走', () => {
      expect(q.askLead('seed', q.ladderContext(['开心']))).toBe('顺着这份开心，找一找心里的种子');
      expect(q.askLead('seed', q.ladderContext([]))).toBe('顺着这份好心情，找一找心里的种子');
      expect(q.askLead('heavy', q.ladderContext(['委屈']))).toBe('顺着这份委屈，往里看一看');
      expect(q.askLead('heavy', q.ladderContext([]))).toBe('');
      expect(q.chooseCopy('seed')).toEqual({ question: '我想怎样，让这颗种子再长一点？', placeholder: '明天，我想……', done: '被看见的种子，会慢慢长大。' });
      expect(q.chooseCopy('heavy')).toEqual({ question: '下一次，我想怎样回应？', placeholder: '明天，我想先……', done: '看见，就是改变的开始。' });
      expect(q.chooseCopy('???')).toEqual(q.chooseCopy('heavy'));
      // 返回副本，改它不影响下一次
      q.chooseCopy('seed').question = '改过';
      expect(q.chooseCopy('seed').question).not.toBe('改过');
    });
  });

  test('随喜提示语、「看」的例子：同一天固定，隔天可以换', () => {
    expect(q.JOY_PLACEHOLDERS).toContain(q.pickJoyPlaceholder('2026-11-16'));
    expect(q.pickJoyPlaceholder('2026-11-16')).toBe(q.pickJoyPlaceholder('2026-11-16'));
    expect(q.SEE_PLACEHOLDERS).toContain(q.pickSeePlaceholder('2026-11-16'));
    expect(q.pickSeePlaceholder('2026-11-16')).toBe(q.pickSeePlaceholder('2026-11-16'));
    const days = Array.from({ length: 14 }, (_, n) => q.pickSeePlaceholder(`2026-11-${10 + n}`));
    expect(new Set(days).size).toBe(2);
  });

  describe('自己加的情绪词：加在哪一组，就按哪一组算明暗', () => {
    test('整理一个词：空白折叠、去掉首尾空白，最多 8 个字（按字符个数，和服务端一样）', () => {
      expect(q.cleanFeelingWord('  担  心 ')).toEqual({ ok: true, word: '担 心' });
      expect(q.cleanFeelingWord('担心')).toEqual({ ok: true, word: '担心' });
      expect(q.cleanFeelingWord('   ')).toEqual({ ok: false, reason: 'empty', word: '' });
      expect(q.cleanFeelingWord(undefined).reason).toBe('empty');
      expect(q.cleanFeelingWord(null).reason).toBe('empty');
      expect(q.cleanFeelingWord('八个字的情绪词啊').ok).toBe(true);
      expect(q.cleanFeelingWord('八个字的情绪词啊啊')).toMatchObject({ ok: false, reason: 'long' });
      expect(q.cleanFeelingWord('😀'.repeat(8)).ok).toBe(true);
      expect(q.cleanFeelingWord('😀'.repeat(9)).ok).toBe(false);
      expect(q.MAX_FEELING_LENGTH).toBe(8);
    });

    test('读出词表：只认两组，去掉空的、太长的、重复的、和内置词重复的，每组最多 8 个', () => {
      expect(q.normalizeCustomFeelings(null)).toEqual({ heavy: [], bright: [] });
      expect(q.normalizeCustomFeelings('乱写的')).toEqual({ heavy: [], bright: [] });
      expect(q.normalizeCustomFeelings({ heavy: '担心', bright: 3 })).toEqual({ heavy: [], bright: [] });
      expect(
        q.normalizeCustomFeelings({
          heavy: [' 担心 ', '担心', '', '开心', '着急', '长'.repeat(9), 5, null, '害怕'],
          bright: ['期待', '害怕', '期待']
        })
      ).toEqual({ heavy: ['担心', '害怕'], bright: ['期待'] });
      const many = Array.from({ length: 12 }, (_, n) => `词${n}`);
      expect(q.normalizeCustomFeelings({ heavy: many }).heavy).toEqual(many.slice(0, q.MAX_CUSTOM_FEELINGS));
      expect(q.MAX_CUSTOM_FEELINGS).toBe(8);
      expect(q.customFeelingCount({ heavy: ['担心'], bright: ['期待', '雀跃'] })).toBe(3);
      expect(q.customFeelingCount(undefined)).toBe(0);
    });

    test('这个词在哪一组：内置的、自己加的都认；不认识的词不在任何一组', () => {
      const custom = { heavy: ['担心'], bright: ['期待'] };
      expect(q.feelingGroupOf('委屈', custom)).toBe('heavy');
      expect(q.feelingGroupOf('开心')).toBe('bright');
      expect(q.feelingGroupOf('担心', custom)).toBe('heavy');
      expect(q.feelingGroupOf('期待', custom)).toBe('bright');
      expect(q.feelingGroupOf('担心')).toBe('');
      expect(q.feelingGroupOf('欢喜', custom)).toBe('');
    });

    test('加一个词：加到所选那一组的末尾；词表里已经有了（不论在哪一组）就不重复加，告诉它在哪一组', () => {
      const added = q.addCustomFeeling(q.emptyCustomFeelings(), 'heavy', ' 担心 ');
      expect(added).toEqual({ ok: true, word: '担心', group: 'heavy', existed: false, custom: { heavy: ['担心'], bright: [] } });
      const second = q.addCustomFeeling(added.custom, 'bright', '期待');
      expect(second.custom).toEqual({ heavy: ['担心'], bright: ['期待'] });
      // 不改传进来的词表
      expect(added.custom).toEqual({ heavy: ['担心'], bright: [] });
      // 已经有了：自己加过的、内置的，哪怕选错了组
      expect(q.addCustomFeeling(second.custom, 'bright', '担心')).toMatchObject({ ok: true, existed: true, group: 'heavy', word: '担心' });
      expect(q.addCustomFeeling(second.custom, 'heavy', '开心')).toMatchObject({ ok: true, existed: true, group: 'bright', custom: second.custom });
    });

    test('加不上的几种情况：空词、太长、组不对、这一组满了；满了以后已有的词还能「加」（只是帮忙选上）', () => {
      expect(q.addCustomFeeling(undefined, 'heavy', '  ')).toEqual({ ok: false, reason: 'empty' });
      expect(q.addCustomFeeling(undefined, 'heavy', '一二三四五六七八九')).toEqual({ ok: false, reason: 'long' });
      expect(q.addCustomFeeling(undefined, 'middle', '担心')).toEqual({ ok: false, reason: 'group' });
      const full = { heavy: Array.from({ length: q.MAX_CUSTOM_FEELINGS }, (_, n) => `词${n}`), bright: [] };
      expect(q.addCustomFeeling(full, 'heavy', '担心')).toEqual({ ok: false, reason: 'full' });
      expect(q.addCustomFeeling(full, 'bright', '期待').ok).toBe(true);
      expect(q.addCustomFeeling(full, 'heavy', '词3')).toMatchObject({ ok: true, existed: true });
    });

    test('删一个词：只删自己加的；内置的词、不在这一组的词原样不动', () => {
      const custom = { heavy: ['担心', '害怕'], bright: ['期待'] };
      expect(q.removeCustomFeeling(custom, 'heavy', '担心')).toEqual({ heavy: ['害怕'], bright: ['期待'] });
      expect(q.removeCustomFeeling(custom, 'heavy', '期待')).toEqual(custom);
      expect(q.removeCustomFeeling(custom, 'heavy', '着急')).toEqual(custom);
      expect(q.removeCustomFeeling(custom, 'nope', '担心')).toEqual(custom);
      expect(custom.heavy).toEqual(['担心', '害怕']);
    });

    test('心情的明暗也认自己加的词：加在哪一组就按哪一组算；不认识的词不算', () => {
      const custom = { heavy: ['担心'], bright: ['期待'] };
      expect(q.ladderContext(['期待'], custom)).toEqual({ tone: 'bright', heavyWord: '', brightWord: '期待' });
      expect(q.ladderContext(['担心', '着急'], custom)).toEqual({ tone: 'heavy', heavyWord: '担心', brightWord: '' });
      expect(q.ladderContext(['期待', '担心'], custom)).toEqual({ tone: 'mixed', heavyWord: '担心', brightWord: '期待' });
      expect(q.ladderContext(['期待'])).toEqual({ tone: 'none', heavyWord: '', brightWord: '' });
      expect(q.ladderContext(['开心', '期待'], custom).brightWord).toBe('开心');
    });

    test('自己加的词会换进问题里：亮的出种子问题，沉的出原来的问题', () => {
      const custom = { heavy: ['担心'], bright: ['期待'] };
      const bright = q.pickLadder('general', 0, q.ladderContext(['期待'], custom));
      expect(bright.kind).toBe('seed');
      expect(bright.questions[0]).toBe('这份期待，是从哪一刻开始的？');
      expect(q.askLead('seed', q.ladderContext(['期待'], custom))).toBe('顺着这份期待，找一找心里的种子');
      const heavy = q.pickLadder('general', 0, q.ladderContext(['担心'], custom));
      expect(heavy.kind).toBe('heavy');
      expect(heavy.questions[2]).toBe('如果不被这份担心推着走，我真正想要的是什么？');
    });

    test('输入框里举的例子是词表里没有的词，这样例子本身就能加上', () => {
      expect(q.FEELING_EXAMPLES).toEqual({ heavy: '担心', bright: '期待' });
      Object.values(q.FEELING_EXAMPLES).forEach(word => expect(q.FEELINGS).not.toContain(word));
      expect(q.FEELING_GROUP_KEYS).toEqual(['heavy', 'bright']);
    });
  });
});
