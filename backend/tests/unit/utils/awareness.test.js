const { expect } = require('chai');
const awareness = require('../../../src/utils/awareness');

const { sanitizeAwareness, composeContent, computeRevisitDueAt, cleanFollowUp, LIMITS } = awareness;

describe('utils/awareness', () => {
  describe('sanitizeAwareness', () => {
    it('只答一问也能通过，其余字段给默认值', () => {
      const result = sanitizeAwareness({ choice: '明天提前十分钟叫他' });
      expect(result.ok).to.equal(true);
      expect(result.value).to.deep.include({ facts: '', feelings: [], bodyAreas: [], asks: [], habitKey: 'general' });
      expect(result.value.choice).to.equal('明天提前十分钟叫他');
    });

    it('全部留空、只有空白时拒绝保存', () => {
      expect(sanitizeAwareness({}).ok).to.equal(false);
      expect(sanitizeAwareness({ facts: '   ', feelings: ['  '], asks: [{ question: 'q', answer: ' ' }] }).message)
        .to.equal('至少写一句再保存');
    });

    it('不是对象时拒绝', () => {
      ['x', null, 3, [], undefined].forEach(input => expect(sanitizeAwareness(input).ok, String(input)).to.equal(false));
    });

    it('情绪词去重、去空白，最多三个，每个最多 8 个字', () => {
      const ok = sanitizeAwareness({ feelings: [' 着急 ', '着急', '委屈', '', '难过'] });
      expect(ok.value.feelings).to.deep.equal(['着急', '委屈', '难过']);
      expect(sanitizeAwareness({ feelings: ['a', 'b', 'c', 'd'] }).message).to.contain('最多选 3 个');
      expect(sanitizeAwareness({ feelings: ['长'.repeat(9)] }).message).to.contain('最多 8 个字');
      expect(sanitizeAwareness({ feelings: '着急' }).ok).to.equal(false);
    });

    it('「问」最多追问三层，层级按顺序重新编号，空回答被丢掉', () => {
      const result = sanitizeAwareness({
        asks: [
          { question: '第一问', answer: '答一' },
          { question: '被跳过', answer: '   ' },
          { question: '第二问', answer: '答二' }
        ]
      });
      expect(result.value.asks).to.deep.equal([
        { level: 1, question: '第一问', answer: '答一' },
        { level: 2, question: '第二问', answer: '答二' }
      ]);
      const four = [1, 2, 3, 4].map(n => ({ question: `q${n}`, answer: `a${n}` }));
      expect(sanitizeAwareness({ asks: four }).message).to.contain('最多追问 3 层');
    });

    it('回答必须带着对应的问题文字', () => {
      expect(sanitizeAwareness({ asks: [{ answer: '只有回答' }] }).message).to.contain('缺少对应的问题');
    });

    it('各字段超过上限时拒绝', () => {
      expect(sanitizeAwareness({ facts: '长'.repeat(LIMITS.facts + 1) }).ok).to.equal(false);
      expect(sanitizeAwareness({ feelingNote: '长'.repeat(LIMITS.feelingNote + 1) }).ok).to.equal(false);
      expect(sanitizeAwareness({ choice: '长'.repeat(LIMITS.choice + 1) }).ok).to.equal(false);
      expect(sanitizeAwareness({ asks: [{ question: 'q', answer: '长'.repeat(LIMITS.answer + 1) }] }).ok).to.equal(false);
      expect(sanitizeAwareness({ asks: [{ question: '长'.repeat(LIMITS.question + 1), answer: 'a' }] }).ok).to.equal(false);
    });

    it('习惯标识不认识时用通用', () => {
      expect(sanitizeAwareness({ facts: 'x', habitKey: 'habit5' }).value.habitKey).to.equal('habit5');
      expect(sanitizeAwareness({ facts: 'x', habitKey: 'evil' }).value.habitKey).to.equal('general');
    });
  });

  describe('composeContent', () => {
    it('按 看 / 感 / 身 / 问 / 择 拼成纯文本，缺的部分不出现', () => {
      const { value } = sanitizeAwareness({
        facts: '孩子磨蹭，我提高了声音。',
        feelings: ['着急', '委屈'],
        feelingNote: '有点累',
        bodyAreas: ['胸口'],
        asks: [{ question: 'q1', answer: '我只听见了时间。' }, { question: 'q2', answer: '他想画完那页。' }],
        choice: '明天提前十分钟叫他'
      });
      expect(composeContent(value)).to.equal([
        '看：孩子磨蹭，我提高了声音。',
        '感：着急、委屈。有点累',
        '身：胸口',
        '问：我只听见了时间。',
        '问：他想画完那页。',
        '择：明天提前十分钟叫他'
      ].join('\n'));
      expect(composeContent(sanitizeAwareness({ choice: '只有择' }).value)).to.equal('择：只有择');
    });

    it('所有字段都写到上限，拼出来也不超过 3000 字', () => {
      const { value } = sanitizeAwareness({
        facts: '长'.repeat(LIMITS.facts),
        feelings: ['八个字的情绪词啊', '八个字的情绪词啊', '八个字的情绪词啊'].map(word => word.slice(0, 8)),
        feelingNote: '长'.repeat(LIMITS.feelingNote),
        bodyAreas: ['八个字的身体部'.slice(0, 8), '另外一处身体部位'.slice(0, 8), '再有一处身体部位'.slice(0, 8)],
        asks: [1, 2, 3].map(n => ({ question: `问${n}`, answer: '长'.repeat(LIMITS.answer) })),
        choice: '长'.repeat(LIMITS.choice)
      });
      expect(Array.from(composeContent(value)).length).to.be.below(awareness.MAX_CONTENT_LENGTH);
    });
  });

  describe('computeRevisitDueAt', () => {
    it('创建当天起第 7 天的东八区早上 6 点', () => {
      // 东八区 2026-11-16 21:30 = UTC 13:30
      const due = computeRevisitDueAt(new Date('2026-11-16T13:30:00Z'));
      expect(due.toISOString()).to.equal('2026-11-22T22:00:00.000Z'); // 11-23 06:00 +08:00
    });

    it('东八区凌晨属于当天，而不是前一个 UTC 日', () => {
      // 东八区 2026-11-17 00:20 = UTC 11-16 16:20，按东八区算是 11-17
      const due = computeRevisitDueAt(new Date('2026-11-16T16:20:00Z'));
      expect(due.toISOString()).to.equal('2026-11-23T22:00:00.000Z'); // 11-24 06:00 +08:00
    });

    it('无效日期返回 null', () => {
      expect(computeRevisitDueAt(new Date('nope'))).to.equal(null);
    });
  });

  describe('标题与富文本', () => {
    const { cleanTitle, cleanRichField } = awareness;

    it('标题：选填，空白折叠，最多 40 字，必须是字符串', () => {
      expect(cleanTitle(undefined)).to.deep.equal({ ok: true, value: '', provided: false });
      expect(cleanTitle(null).provided).to.equal(false);
      expect(cleanTitle('  今天   的觉察 ')).to.deep.equal({ ok: true, value: '今天 的觉察', provided: true });
      expect(cleanTitle('')).to.deep.equal({ ok: true, value: '', provided: true });
      expect(cleanTitle('长'.repeat(40)).ok).to.equal(true);
      expect(cleanTitle('长'.repeat(41)).message).to.contain('最多 40 字');
      expect(cleanTitle(123).ok).to.equal(false);
    });

    it('带格式的字段：纯文本由清洗后的 HTML 推出，客户端传来的纯文本不被信任', () => {
      const result = cleanRichField('<p>真正的<strong>文字</strong></p>', '被篡改的纯文本', '看');
      expect(result).to.deep.equal({ ok: true, text: '真正的文字', html: '<p>真正的<strong>文字</strong></p>' });
    });

    it('没有格式时只保留纯文本，不存 HTML', () => {
      expect(cleanRichField('<p>普通的一句</p>', '', '看')).to.deep.equal({ ok: true, text: '普通的一句', html: '' });
      expect(cleanRichField(undefined, '  只有纯文本 ', '看')).to.deep.equal({ ok: true, text: '只有纯文本', html: '' });
      expect(cleanRichField('', '', '看')).to.deep.equal({ ok: true, text: '', html: '' });
    });

    it('HTML 被清洗成空，纯文本也算空；危险内容被去掉', () => {
      expect(cleanRichField('<script>x</script>', '不会采用', '看').text).to.equal('');
      expect(cleanRichField('<p onclick="x"><span style="color:red">红</span></p>', '', '看').html).to.equal('<p><span style="color:red">红</span></p>');
    });

    it('HTML 过长时报错，带上是哪一问', () => {
      const result = cleanRichField(`<p>${'x'.repeat(12001)}</p>`, '', '择');
      expect(result.ok).to.equal(false);
      expect(result.message).to.contain('「择」');
    });

    it('觉察：「看」「问」「择」支持 HTML，纯文本从中推出；没有格式时不带 HTML 字段', () => {
      const result = sanitizeAwareness({
        factsHtml: '<p>孩子磨蹭，<span style="color: #dc2626">我提高了声音</span></p>',
        asks: [
          { question: '那一刻我在意什么？', answerHtml: '<p><strong>时间</strong></p>' },
          { question: '再问', answer: '普通的回答' }
        ],
        choiceHtml: '<p>明天先问一句</p>'
      });
      expect(result.ok).to.equal(true);
      expect(result.value.facts).to.equal('孩子磨蹭，我提高了声音');
      expect(result.value.factsHtml).to.equal('<p>孩子磨蹭，<span style="color:#dc2626">我提高了声音</span></p>');
      expect(result.value.asks).to.deep.equal([
        { level: 1, question: '那一刻我在意什么？', answer: '时间', answerHtml: '<p><strong>时间</strong></p>' },
        { level: 2, question: '再问', answer: '普通的回答' }
      ]);
      expect(result.value.choice).to.equal('明天先问一句');
      expect(result.value).to.not.have.property('choiceHtml');
    });

    it('觉察：纯文本长度上限按 HTML 推出的文字算，不是按 HTML 本身', () => {
      const ok = sanitizeAwareness({ factsHtml: `<p>${'长'.repeat(LIMITS.facts)}</p>` });
      expect(ok.ok).to.equal(true);
      const tooLong = sanitizeAwareness({ factsHtml: `<p>${'长'.repeat(LIMITS.facts + 1)}</p>` });
      expect(tooLong.ok).to.equal(false);
    });
  });

  describe('cleanFollowUp', () => {
    it('去掉首尾空白，空内容和超长内容被拒绝', () => {
      expect(cleanFollowUp('  这周做到了三天  ')).to.deep.equal({ ok: true, value: '这周做到了三天' });
      expect(cleanFollowUp('   ').ok).to.equal(false);
      expect(cleanFollowUp(undefined).ok).to.equal(false);
      expect(cleanFollowUp('长'.repeat(LIMITS.followUp + 1)).ok).to.equal(false);
    });
  });
});
