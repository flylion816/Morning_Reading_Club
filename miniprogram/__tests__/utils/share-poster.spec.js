const poster = require('../../pages/joy-notes/share-poster');

// 一个会记录所有绘制调用的假 canvas：汉字宽 = 字号，其他字符宽 = 字号的一半
function fakeCanvas() {
  const calls = [];
  const gradient = { addColorStop: jest.fn() };
  const ctx = {
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    textAlign: 'left',
    measureText(ch) {
      const size = Number((/(\d+(?:\.\d+)?)px/.exec(this.font) || [])[1]) || 16;
      return { width: /[一-鿿，。！？「」：；、…（）]/.test(ch) ? size : size * 0.5 };
    },
    fillText(value, x, y) { calls.push({ op: 'text', value, x, y, font: this.font, color: this.fillStyle, align: this.textAlign }); },
    fillRect(x, y, w, h) { calls.push({ op: 'rect', x, y, w, h, color: this.fillStyle }); },
    drawImage(image, x, y, w, h) { calls.push({ op: 'image', image, x, y, w, h }); },
    createLinearGradient() { return gradient; },
    beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, arc() {}, closePath() {}, fill() {}, stroke() {}, clearRect() {}, scale: jest.fn(), setTransform() {}
  };
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  return { canvas, ctx, calls };
}

const note = (extra = {}) => ({
  id: 'n1',
  kind: 'joy',
  title: '',
  content: '今天读到一句话',
  contentHtml: '',
  createdAt: new Date(2026, 10, 16, 7, 40).toISOString(),
  periodId: 'p1',
  ...extra
});

const awarenessNote = (extra = {}) => note({
  kind: 'awareness',
  content: '看：x',
  awareness: {
    facts: '孩子磨蹭，我提高了声音。',
    factsHtml: '<p>孩子磨蹭，<span style="color:#dc2626">我提高了声音</span>。</p>',
    feelings: ['着急', '委屈'],
    bodyAreas: ['胸口'],
    feelingNote: '有点累',
    asks: [
      { level: 1, question: '那一刻，我有没有先听懂对方？', answer: '没有', answerHtml: '' },
      { level: 2, question: '如果我是 TA，我在经历什么？', answer: '想画完那页', answerHtml: '<p><strong>想画完那页</strong></p>' }
    ],
    choice: '明天提前十分钟叫他',
    choiceHtml: '',
    followUps: [{ content: '这周做到了三天', createdAt: new Date(2026, 10, 23).toISOString() }],
    revisit: { status: 'pending' }
  },
  ...extra
});

describe('随喜 / 觉察分享长图', () => {
  describe('payloadFromNote', () => {
    test('随喜：带上标题、正文、HTML、日期，作者没写昵称时叫「书友」', () => {
      const payload = poster.payloadFromNote(note({ title: '标题', contentHtml: '<p><strong>粗</strong></p>' }), { sourceLabel: '第 12 期' });
      expect(payload).toMatchObject({
        id: 'n1', kind: 'joy', title: '标题', authorName: '书友', sourceLabel: '第 12 期', periodLinked: true,
        content: '今天读到一句话', contentHtml: '<p><strong>粗</strong></p>', awareness: null
      });
      expect(payload.dateLabel).toBe('11月16日 清晨');
      expect(poster.payloadFromNote(note({ periodId: null })).periodLinked).toBe(false);
      expect(poster.payloadFromNote(note(), { authorName: '狮子' }).authorName).toBe('狮子');
    });

    test('觉察：问带上一叩 / 再叩，后来带上日期', () => {
      const payload = poster.payloadFromNote(awarenessNote());
      expect(payload.kind).toBe('awareness');
      expect(payload.awareness.asks.map(ask => ask.label)).toEqual(['一叩', '再叩']);
      expect(payload.awareness.followUps).toEqual([{ content: '这周做到了三天', dateLabel: '11月23日' }]);
      expect(payload.awareness.feelings).toEqual(['着急', '委屈']);
    });
  });

  describe('buildPosterModel', () => {
    test('随喜：一段正文；有 HTML 时解析成带样式的片段，没有时按行拆成纯文本', () => {
      const plain = poster.buildPosterModel(poster.payloadFromNote(note({ content: '第一行\n第二行' })));
      expect(plain).toMatchObject({ kind: 'joy', seal: '喜', kicker: '随喜记', authorLine: '书友 分享了一句随喜' });
      expect(plain.sections).toHaveLength(1);
      expect(plain.sections[0].blocks.map(block => block.runs[0].text)).toEqual(['第一行', '第二行']);
      const rich = poster.buildPosterModel(poster.payloadFromNote(note({ contentHtml: '<p><span style="color:#dc2626">重点</span></p>' })));
      expect(rich.sections[0].blocks[0].runs[0]).toMatchObject({ text: '重点', color: '#dc2626' });
    });

    test('觉察：看、感、问（带问题）、择、后来，各自成段；标题和来源进头部', () => {
      const model = poster.buildPosterModel(poster.payloadFromNote(awarenessNote({ title: '孩子磨蹭的早晨' }), { authorName: '狮子', sourceLabel: '连接之力 · 第 5 天' }));
      expect(model).toMatchObject({ kind: 'awareness', seal: '觉', kicker: '觉察日记', authorLine: '狮子 分享了一页觉察', title: '孩子磨蹭的早晨' });
      expect(model.meta).toBe('11月16日 清晨 · 连接之力 · 第 5 天');
      expect(model.sections.map(section => section.type)).toEqual(['body', 'feel', 'ask', 'ask', 'choose', 'later']);
      expect(model.sections.map(section => section.label)).toEqual(['看', '感', '问 · 一叩', '问 · 再叩', '择', '后来 · 11月23日']);
      expect(model.sections[2].question).toBe('那一刻，我有没有先听懂对方？');
    });

    test('觉察里没有写的部分不出现', () => {
      const model = poster.buildPosterModel(poster.payloadFromNote(note({
        kind: 'awareness',
        awareness: { facts: '', feelings: [], bodyAreas: [], feelingNote: '', asks: [], choice: '只写了择', followUps: [] }
      })));
      expect(model.sections.map(section => section.type)).toEqual(['choose']);
    });
  });

  describe('layoutBlocks（排版）', () => {
    const measure = (font, ch) => {
      const size = Number((/(\d+(?:\.\d+)?)px/.exec(font) || [])[1]);
      return /[一-鿿]/.test(ch) ? size : size / 2;
    };
    const run = (text, extra = {}) => ({ text, bold: false, italic: false, underline: false, strike: false, color: '', ...extra });
    const layout = (blocks, options = {}) => poster.layoutBlocks(measure, blocks, { width: 300, fontSize: 20, lineHeight: 36, ...options });

    test('按宽度换行：每行最多 15 个汉字', () => {
      const lines = layout([{ kind: 'p', runs: [run('一二三四五六七八九十一二三四五六七八九十')] }]);
      expect(lines).toHaveLength(2);
      expect(lines[0].segments[0].text).toBe('一二三四五六七八九十一二三四五');
      expect(lines[1].segments[0].text).toBe('六七八九十');
    });

    test('同样式的字合并成一个片段；颜色、粗体、下划线各自成段并保留', () => {
      const [line] = layout([{
        kind: 'p',
        runs: [run('普通'), run('红色', { color: '#dc2626' }), run('粗体', { bold: true }), run('下划', { underline: true })]
      }]);
      expect(line.segments.map(segment => [segment.text, segment.color, /bold/.test(segment.font), segment.underline])).toEqual([
        ['普通', '#2b2622', false, false],
        ['红色', '#dc2626', false, false],
        ['粗体', '#2b2622', true, false],
        ['下划', '#2b2622', false, true]
      ]);
    });

    test('换行片段强制换行；空段落占一行', () => {
      const lines = layout([
        { kind: 'p', runs: [run('上'), run('\n'), run('下')] },
        { kind: 'p', runs: [run('\n')] },
        { kind: 'p', runs: [run('末')] }
      ]);
      expect(lines.map(line => line.segments.map(segment => segment.text).join(''))).toEqual(['上', '下', '', '末']);
    });

    test('标题更大更粗；列表有缩进和序号；引用有竖条标记', () => {
      const lines = layout([
        { kind: 'h', level: 2, runs: [run('标题')] },
        { kind: 'li', ordered: true, index: 1, runs: [run('第一项')] },
        { kind: 'li', ordered: false, index: 1, runs: [run('一点')] },
        { kind: 'quote', runs: [run('引用')] }
      ]);
      expect(lines[0].size).toBeCloseTo(24);
      expect(lines[0].segments[0].font).toContain('bold');
      expect(lines[1]).toMatchObject({ bullet: '1.', indent: 30 });
      expect(lines[2]).toMatchObject({ bullet: '•', indent: 30 });
      expect(lines[3].quote).toBe(true);
    });

    test('段落之间留空：最后一行带段后间距；总高度是各行高度加间距', () => {
      const lines = layout([{ kind: 'p', runs: [run('甲')] }, { kind: 'p', runs: [run('乙')] }]);
      expect(lines[0].after).toBeGreaterThan(0);
      expect(poster.linesHeight(lines)).toBeCloseTo(lines.reduce((sum, line) => sum + line.height + line.after, 0));
    });

    test('wrapPlain：标题按宽度折行，超过最大行数时末行用省略号', () => {
      // 40 个字在 15 字一行时要排 3 行，最多只给 2 行：末行用省略号收尾
      const rows = poster.wrapPlain(measure, '一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十', { width: 300, size: 20, maxLines: 2 });
      expect(rows).toHaveLength(2);
      expect(rows[1].endsWith('…')).toBe(true);
      expect(poster.wrapPlain(measure, '短标题', { width: 300, size: 20 })).toEqual(['短标题']);
      expect(poster.wrapPlain(measure, '甲\n乙', { width: 300, size: 20 })).toEqual(['甲', '乙']);
    });
  });

  describe('renderPoster（绘制）', () => {
    const render = (payload, extra = {}) => {
      const fake = fakeCanvas();
      const result = poster.renderPoster({ canvas: fake.canvas, model: poster.buildPosterModel(payload), dpr: 2, ...extra });
      return { ...fake, result };
    };
    const textsOf = calls => calls.filter(call => call.op === 'text').map(call => call.value).join('');

    test('随喜：画出栏目名、谁分享的、正文和品牌；返回导出尺寸', () => {
      const { calls, canvas, result } = render(poster.payloadFromNote(note({ title: '一句好话' }), { authorName: '狮子' }));
      const text = textsOf(calls);
      expect(text).toContain('随喜记');
      expect(text).toContain('狮子 分享了一句随喜');
      expect(text).toContain('一句好话');
      expect(text).toContain('今天读到一句话');
      expect(result).toMatchObject({ width: 900, truncated: false });
      expect(result.height).toBeGreaterThanOrEqual(900);
      expect(canvas.width).toBe(Math.round(900 * result.scale));
      expect(canvas.height).toBe(Math.round(result.height * result.scale));
    });

    test('重点颜色、粗体、下划线：用对应的颜色和字体画出来，下划线是一条细矩形', () => {
      const { calls } = render(poster.payloadFromNote(note({
        contentHtml: '<p>今天<span style="color:#dc2626">很重要</span>，<strong>要记住</strong>，<u>划线</u></p>'
      })));
      const red = calls.find(call => call.op === 'text' && call.value === '很重要');
      expect(red.color).toBe('#dc2626');
      const bold = calls.find(call => call.op === 'text' && call.value === '要记住');
      expect(bold.font).toContain('bold');
      const underlined = calls.find(call => call.op === 'text' && call.value === '划线');
      const underline = calls.find(call => call.op === 'rect' && Math.abs(call.x - underlined.x) < 0.01 && call.y > underlined.y);
      expect(underline).toBeTruthy();
      expect(underline.w).toBeGreaterThan(0);
    });

    test('觉察：看、感（情绪词和身体）、问（问题 + 回答）、择、后来都画出来，回答里的格式保留', () => {
      const { calls } = render(poster.payloadFromNote(awarenessNote({ title: '孩子磨蹭的早晨' }), { authorName: '狮子', sourceLabel: '连接之力 · 第 5 天' }));
      const text = textsOf(calls);
      ['觉察日记', '孩子磨蹭的早晨', '连接之力', '看', '感', '着急', '委屈', '有点累', '身体：胸口', '问 · 一叩', '那一刻，我有没有先听懂对方？', '问 · 再叩', '择', '后来 · 11月23日', '这周做到了三天'].forEach(piece => {
        expect(text).toContain(piece);
      });
      expect(calls.find(call => call.op === 'text' && call.value.includes('我提高了声音')).color).toBe('#dc2626');
      expect(calls.find(call => call.op === 'text' && call.value === '想画完那页').font).toContain('bold');
      // 「择」整段加粗，用晨光深色
      const choose = calls.find(call => call.op === 'text' && call.value === '明天提前十分钟叫他');
      expect(choose.font).toContain('bold');
      expect(choose.color).toBe('#8a4b12');
    });

    test('情绪词太多会折成多行，不画出界', () => {
      const feelings = ['着急', '焦虑', '担心', '生气', '烦躁', '委屈', '难过', '失落', '无力', '害怕', '内疚', '平静'];
      const { calls } = render(poster.payloadFromNote(note({ kind: 'awareness', awareness: { facts: '', feelings, bodyAreas: [], feelingNote: '', asks: [], choice: '', followUps: [] } })));
      const chips = calls.filter(call => call.op === 'text' && feelings.includes(call.value));
      expect(chips).toHaveLength(feelings.length);
      chips.forEach(chip => expect(chip.x).toBeLessThanOrEqual(900));
      expect(new Set(chips.map(chip => Math.round(chip.y))).size).toBeGreaterThan(1);
    });

    test('小程序码：专属码画在右下角，说明「扫码，读 TA 的这一页」；退回通用码时说明「扫码共读」', () => {
      const image = { id: 'qr' };
      const precise = render(poster.payloadFromNote(note()), { qrImage: image, qrPrecise: true });
      const drawn = precise.calls.find(call => call.op === 'image');
      expect(drawn.image).toBe(image);
      expect(drawn.x).toBeGreaterThan(600);
      expect(drawn.y).toBeGreaterThan(precise.result.height - 400);
      expect(textsOf(precise.calls)).toContain('扫码，读 TA 的这一页');
      const fallback = render(poster.payloadFromNote(note()), { qrImage: image, qrPrecise: false });
      expect(textsOf(fallback.calls)).toContain('扫码共读');
      expect(textsOf(fallback.calls)).not.toContain('读 TA 的这一页');
      expect(render(poster.payloadFromNote(note())).calls.some(call => call.op === 'image')).toBe(false);
    });

    test('内容很长：截断并提示扫码查看，高度不超过上限；清晰度按像素上限自动降低', () => {
      const long = Array.from({ length: 400 }, (_, index) => `第${index}行的内容比较长一些，写得很认真。`).join('\n');
      const { calls, result } = render(poster.payloadFromNote(note({ content: long })));
      expect(result.truncated).toBe(true);
      expect(result.height).toBeLessThanOrEqual(poster.MAX_HEIGHT);
      expect(textsOf(calls)).toContain('完整的请扫码查看');
      expect(result.width * result.scale * result.height * result.scale).toBeLessThanOrEqual(poster.MAX_PIXELS + 1);
    });

    test('短内容至少 900 高，清晰度用传入的 dpr', () => {
      const { result } = render(poster.payloadFromNote(note({ content: '短' })));
      expect(result.height).toBe(900);
      expect(result.scale).toBe(2);
    });
  });
});
