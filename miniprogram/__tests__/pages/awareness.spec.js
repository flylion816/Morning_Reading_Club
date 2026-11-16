jest.mock('../../services/joy-note.service', () => ({ create: jest.fn() }));
jest.mock('../../utils/require-login', () => ({ requireLogin: jest.fn(() => true) }));

describe('觉察静室', () => {
  let config;
  let page;
  let service;
  let store;
  let requireLogin;
  let tenantStorage;

  const mount = (options = {}) => {
    page = {
      ...config,
      data: JSON.parse(JSON.stringify(config.data)),
      setData(update, callback) {
        this.data = { ...this.data, ...update };
        if (callback) callback();
      }
    };
    page.onLoad(options);
    return page;
  };

  const write = (step, patch) => {
    page.data.step = step;
    Object.assign(page.data, patch);
  };

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    global.Page = jest.fn(value => { config = value; });
    wx.__storage = {};
    wx.showToast = jest.fn();
    wx.navigateTo = jest.fn();
    wx.navigateBack = jest.fn();
    wx.redirectTo = jest.fn();
    wx.showModal = jest.fn();
    wx.setNavigationBarColor = jest.fn();
    global.getCurrentPages = jest.fn(() => []);
    global.getApp = jest.fn(() => ({ globalData: { userInfo: { _id: 'u1' } } }));
    service = require('../../services/joy-note.service');
    service.create.mockReset();
    service.create.mockResolvedValue({ id: 'n1' });
    requireLogin = require('../../utils/require-login').requireLogin;
    requireLogin.mockReturnValue(true);
    store = require('../../utils/joy-note-store');
    tenantStorage = require('../../utils/storage').tenantStorage;
    require('../../pages/joy-notes/awareness/awareness');
  });

  afterEach(() => {
    if (page && page.onUnload) page.onUnload();
    jest.useRealTimers();
    delete global.Page;
    delete global.getCurrentPages;
    delete global.getApp;
  });

  describe('停', () => {
    test('先停一下：呼吸三次之后出现「我准备好了」，但不会自动跳走', () => {
      mount();
      expect(page.data.step).toBe('pause');
      expect(page.data.breathDone).toBe(false);
      jest.advanceTimersByTime(4000);
      expect(page.data.breaths).toBe(1);
      jest.advanceTimersByTime(8000);
      expect(page.data.breaths).toBe(3);
      expect(page.data.breathDone).toBe(true);
      jest.advanceTimersByTime(60000);
      expect(page.data.step).toBe('pause');
    });

    test('随时可以直接开始，进入「看」', () => {
      mount();
      page.begin();
      expect(page.data.step).toBe('see');
      expect(page.data.progress).toBe(1);
      expect(page.data.light).toBe(false);
      jest.advanceTimersByTime(20000);
      expect(page.data.breaths).toBe(0);
    });

    test('没登录时不进静室', () => {
      requireLogin.mockReturnValue(false);
      mount();
      expect(page.data.breaths).toBe(0);
      jest.advanceTimersByTime(5000);
      expect(page.data.breaths).toBe(0);
    });
  });

  describe('课程和习惯', () => {
    test('带着课程进来：按课程标题识别习惯，问题跟着习惯走', () => {
      mount({ periodId: 'p1', sectionId: 's1', source: encodeURIComponent('连接之力 · 第 5 天 · 知彼解己') });
      expect(page.data).toMatchObject({ periodId: 'p1', sectionId: 's1', habitKey: 'habit5', habitName: '知彼解己' });
      expect(page.data.askItems).toHaveLength(1);
      expect(page.data.askItems[0].question).toBe('那一刻，我有没有先听懂对方？');
    });

    test('没有课程或认不出习惯时用通用问题，不显示习惯名', () => {
      mount();
      expect(page.data).toMatchObject({ periodId: '', sectionId: '', habitKey: 'general', habitName: '' });
      mount({ periodId: 'p1', sectionId: 's1', source: '品德成功论' });
      expect(page.data.habitKey).toBe('general');
    });

    test('从一条随喜开始：那句话成为「看」的初始内容（最多 300 字）', () => {
      mount({ seed: encodeURIComponent('字'.repeat(400)) });
      expect(page.data.facts).toBe('字'.repeat(300));
    });
  });

  describe('步骤', () => {
    test('看 → 感 → 问 → 择，跳过只是进入下一问，退回不会低于「看」', () => {
      mount();
      page.begin();
      page.next();
      expect(page.data.step).toBe('feel');
      page.skip();
      expect(page.data.step).toBe('ask');
      page.next();
      expect(page.data.step).toBe('choose');
      expect(page.data.light).toBe(true);
      expect(page.data.revisitDate).toMatch(/^\d+月\d+日$/);
      page.next();
      expect(page.data.step).toBe('choose');
      page.back();
      page.back();
      page.back();
      page.back();
      expect(page.data.step).toBe('see');
    });

    test('夜色屏用白色状态栏文字，晨光屏用黑色', () => {
      mount();
      expect(wx.setNavigationBarColor).toHaveBeenLastCalledWith(expect.objectContaining({ frontColor: '#ffffff' }));
      page.enter('choose');
      expect(wx.setNavigationBarColor).toHaveBeenLastCalledWith(expect.objectContaining({ frontColor: '#000000' }));
    });
  });

  describe('感', () => {
    test('最多选三个情绪词，再点已选的可以取消', () => {
      mount();
      const tap = name => page.toggleFeeling({ currentTarget: { dataset: { name } } });
      ['着急', '委屈', '难过'].forEach(tap);
      expect(page.data.feelings).toEqual(['着急', '委屈', '难过']);
      tap('生气');
      expect(page.data.feelings).toEqual(['着急', '委屈', '难过']);
      expect(wx.showToast).toHaveBeenCalledWith({ title: '最多选 3 个', icon: 'none' });
      tap('委屈');
      expect(page.data.feelings).toEqual(['着急', '难过']);
      const selected = page.data.feelingGroups
        .reduce((all, group) => all.concat(group.chips), [])
        .filter(chip => chip.on)
        .map(chip => chip.name);
      expect(selected).toEqual(['着急', '难过']);
    });

    test('情绪词分两组：沉一点的在前，亮一点的在后，亮的一样能选', () => {
      mount();
      expect(page.data.feelingGroups.map(group => group.label)).toEqual(['沉一点的', '亮一点的']);
      page.toggleFeeling({ currentTarget: { dataset: { name: '开心' } } });
      expect(page.data.feelings).toEqual(['开心']);
      expect(page.data.feelingGroups[1].chips.find(chip => chip.name === '开心').on).toBe(true);
      expect(page.data.feelingGroups[0].chips.every(chip => !chip.on)).toBe(true);
    });

    test('身体哪里有感觉：最多三处', () => {
      mount();
      page.toggleBody();
      expect(page.data.bodyOpen).toBe(true);
      ['头', '胸口', '胃', '手'].forEach(name => page.toggleBodyArea({ currentTarget: { dataset: { name } } }));
      expect(page.data.bodyAreas).toEqual(['头', '胸口', '胃']);
    });
  });

  describe('感：找不到合适的词，自己加一个', () => {
    const tap = name => page.toggleFeeling({ currentTarget: { dataset: { name } } });
    const chipsOf = key => page.data.feelingGroups.find(group => group.key === key).chips;
    // 点开小面板（没开的话）、选组、写词、点「加上」
    const add = (word, group = 'heavy') => {
      if (!page.data.addOpen) page.toggleAddFeeling();
      page.chooseAddGroup({ currentTarget: { dataset: { group } } });
      page.onAddInput({ detail: { value: word } });
      page.confirmAddFeeling();
    };
    const longPress = (name, group) => page.removeCustomFeeling({ currentTarget: { dataset: { name, group } } });

    test('点「自己加一个」展开小面板，默认加到「沉一点的」，输入框里的例子跟着组换', () => {
      mount();
      expect(page.data).toMatchObject({ addOpen: false, addGroup: 'heavy', addHint: '写一个词，比如：担心', hasCustom: false });
      page.toggleAddFeeling();
      expect(page.data.addOpen).toBe(true);
      page.chooseAddGroup({ currentTarget: { dataset: { group: 'bright' } } });
      expect(page.data).toMatchObject({ addGroup: 'bright', addHint: '写一个词，比如：期待' });
      page.chooseAddGroup({ currentTarget: { dataset: { group: 'nope' } } });
      expect(page.data.addGroup).toBe('bright');
      page.toggleAddFeeling();
      expect(page.data.addOpen).toBe(false);
    });

    test('加上：词出现在所选那一组的末尾并被选中，面板收起，本机记下', () => {
      mount();
      add('  担心 ');
      expect(page.data.feelings).toEqual(['担心']);
      expect(chipsOf('heavy').slice(-1)).toEqual([{ name: '担心', on: true, custom: true }]);
      expect(chipsOf('bright').some(chip => chip.custom)).toBe(false);
      expect(page.data).toMatchObject({ addOpen: false, addText: '', hasCustom: true });
      expect(store.read(store.KEYS.customFeelings)).toEqual({ heavy: ['担心'], bright: [] });
      add('期待', 'bright');
      expect(page.data.feelings).toEqual(['担心', '期待']);
      expect(chipsOf('bright').slice(-1)).toEqual([{ name: '期待', on: true, custom: true }]);
      expect(store.read(store.KEYS.customFeelings)).toEqual({ heavy: ['担心'], bright: ['期待'] });
      // 内置的词还是原样，在自己加的词前面
      expect(chipsOf('heavy')).toHaveLength(9);
      expect(chipsOf('heavy')[0]).toEqual({ name: '着急', on: false });
    });

    test('下次进静室，自己加的词还在（没被选中）；点「重新开始」也不会清掉', () => {
      mount();
      add('担心');
      page.onFacts({ detail: { value: '写到一半' } });
      page.flushDraft();
      page.onUnload();
      mount();
      wx.showModal.mock.calls[0][0].success({ confirm: false });
      expect(page.data.feelings).toEqual([]);
      expect(chipsOf('heavy').slice(-1)).toEqual([{ name: '担心', on: false, custom: true }]);
      expect(page.data.hasCustom).toBe(true);
    });

    test('自己加的词按用户分开记，换账号看不到上一个人的', () => {
      const { STORAGE_KEYS } = require('../../config/constants');
      tenantStorage.set(STORAGE_KEYS.USER_INFO, { _id: 'u1' });
      mount();
      add('担心');
      page.onUnload();
      tenantStorage.set(STORAGE_KEYS.USER_INFO, { _id: 'u2' });
      mount();
      expect(page.data.hasCustom).toBe(false);
      expect(chipsOf('heavy')).toHaveLength(8);
      page.onUnload();
      tenantStorage.set(STORAGE_KEYS.USER_INFO, { _id: 'u1' });
      mount();
      expect(chipsOf('heavy').slice(-1)).toEqual([{ name: '担心', on: false, custom: true }]);
    });

    test('词表里已经有的词不重复加，只帮忙选上，哪怕选错了组', () => {
      mount();
      add('开心', 'heavy');
      expect(page.data.feelings).toEqual(['开心']);
      expect(wx.showToast).toHaveBeenLastCalledWith({ title: '词表里已经有「开心」，帮你选上了', icon: 'none' });
      expect(store.read(store.KEYS.customFeelings)).toBe(null);
      expect(chipsOf('bright').find(chip => chip.name === '开心').on).toBe(true);
      expect(chipsOf('heavy')).toHaveLength(8);
      // 自己加过的词，在另一组里再加一次
      add('担心');
      tap('担心');
      expect(page.data.feelings).toEqual(['开心']);
      add('担心', 'bright');
      expect(page.data.feelings).toEqual(['开心', '担心']);
      expect(chipsOf('bright').some(chip => chip.name === '担心')).toBe(false);
      expect(wx.showToast).toHaveBeenLastCalledWith({ title: '词表里已经有「担心」，帮你选上了', icon: 'none' });
      // 已经选着的：不提示
      wx.showToast.mockClear();
      add('担心');
      expect(wx.showToast).not.toHaveBeenCalled();
      expect(page.data.feelings).toEqual(['开心', '担心']);
    });

    test('空词、太长的词加不上，只提示、面板留着接着改；每组最多加 8 个', () => {
      mount();
      add('   ');
      expect(wx.showToast).toHaveBeenLastCalledWith({ title: '先写一个词', icon: 'none' });
      expect(page.data.addOpen).toBe(true);
      page.onAddInput({ detail: { value: '一二三四五六七八九' } });
      page.confirmAddFeeling();
      expect(wx.showToast).toHaveBeenLastCalledWith({ title: '最多 8 个字', icon: 'none' });
      expect(page.data.feelings).toEqual([]);
      expect(store.read(store.KEYS.customFeelings)).toBe(null);
      for (let n = 0; n < 8; n += 1) add(`词${n}`);
      expect(store.read(store.KEYS.customFeelings).heavy).toHaveLength(8);
      add('第九个');
      expect(wx.showToast).toHaveBeenLastCalledWith({ title: '这一组最多加 8 个，长按旧的可以删掉', icon: 'none' });
      expect(store.read(store.KEYS.customFeelings).heavy).toHaveLength(8);
      expect(chipsOf('heavy')).toHaveLength(16);
      // 另一组不受影响
      add('期待', 'bright');
      expect(store.read(store.KEYS.customFeelings).bright).toEqual(['期待']);
    });

    test('已经选满三个：新词先加进词表、不选，提示先取消一个', () => {
      mount();
      ['着急', '委屈', '难过'].forEach(tap);
      add('担心');
      expect(page.data.feelings).toEqual(['着急', '委屈', '难过']);
      expect(wx.showToast).toHaveBeenLastCalledWith({ title: '已加上，先取消一个再选它', icon: 'none' });
      expect(chipsOf('heavy').slice(-1)).toEqual([{ name: '担心', on: false, custom: true }]);
      tap('难过');
      tap('担心');
      expect(page.data.feelings).toEqual(['着急', '委屈', '担心']);
      // 词表里已有的词也一样
      tap('担心');
      tap('难过');
      add('担心');
      expect(wx.showToast).toHaveBeenLastCalledWith({ title: '词表里已经有「担心」，先取消一个再选它', icon: 'none' });
    });

    test('加在哪一组，问题就按哪一种出：加在「亮一点的」问种子，加在「沉一点的」问保护', () => {
      mount();
      page.begin();
      page.next();
      add('期待', 'bright');
      page.next();
      expect(page.data).toMatchObject({ ladderKind: 'seed', askLead: '顺着这份期待，找一找心里的种子' });
      expect(page.data.askItems[0].question).toBe('这份期待，是从哪一刻开始的？');
      page.back();
      tap('期待');
      add('担心', 'heavy');
      page.next();
      expect(page.data).toMatchObject({ ladderKind: 'heavy', askLead: '顺着这份担心，往里看一看' });
      expect(page.data.ladder[2]).toBe('如果不被这份担心推着走，我真正想要的是什么？');
    });

    test('长按自己加的词：确认后删掉并取消选中；选「留着」不动；内置的词没有这个手势', () => {
      mount();
      add('担心');
      longPress('担心', 'heavy');
      const dialog = wx.showModal.mock.calls[0][0];
      expect(dialog).toMatchObject({ title: '删掉这个词？', confirmText: '删掉', cancelText: '留着' });
      expect(dialog.content).toContain('「担心」');
      dialog.success({ confirm: false });
      expect(page.data.feelings).toEqual(['担心']);
      expect(store.read(store.KEYS.customFeelings)).toEqual({ heavy: ['担心'], bright: [] });
      dialog.success({ confirm: true });
      expect(page.data.feelings).toEqual([]);
      expect(page.data.hasCustom).toBe(false);
      expect(chipsOf('heavy').some(chip => chip.name === '担心')).toBe(false);
      expect(store.read(store.KEYS.customFeelings)).toBe(null);
      // 内置的词、已经没有的词、点错了位置：都不弹窗
      wx.showModal.mockClear();
      longPress('着急', 'heavy');
      longPress('担心', 'heavy');
      longPress('', 'heavy');
      longPress('开心', 'bright');
      expect(wx.showModal).not.toHaveBeenCalled();
    });

    test('草稿：选了自己加的词，退出后接着写，词和选中状态都在，问题还是按加的那一组出；本机词表里删了也一样', () => {
      mount();
      page.begin();
      page.next();
      add('期待', 'bright');
      page.next();
      page.onAnswer({ currentTarget: { dataset: { index: 0 } }, detail: { value: '想到周末就开心' } });
      page.flushDraft();
      expect(store.read(store.KEYS.awarenessDraft)).toMatchObject({ feelings: ['期待'], customFeelings: { heavy: [], bright: ['期待'] } });
      page.onUnload();
      // 这期间把词从本机词表里删了：草稿里选着的词还要在，不然选了却没处取消
      store.write(store.KEYS.customFeelings, null);
      mount();
      wx.showModal.mock.calls[0][0].success({ confirm: true });
      expect(page.data.feelings).toEqual(['期待']);
      expect(chipsOf('bright').slice(-1)).toEqual([{ name: '期待', on: true, custom: true }]);
      expect(page.data.askItems[0]).toMatchObject({ question: '这份期待，是从哪一刻开始的？', answer: '想到周末就开心' });
    });

    test('旧草稿里认不出在哪一组的词（比如旧版本里的「担心」）不带回来，免得选了却没处取消', () => {
      store.write(store.KEYS.awarenessDraft, { version: 1, step: 'feel', facts: '旧的', feelings: ['担心', '委屈'], habitKey: 'general', answers: [] });
      mount();
      wx.showModal.mock.calls[0][0].success({ confirm: true });
      expect(page.data.feelings).toEqual(['委屈']);
    });

    test('保存：自己加的词和别的情绪词一样提交', async () => {
      mount();
      page.begin();
      page.next();
      add('期待', 'bright');
      tap('感动');
      page.onChoice({ detail: { value: '周末带他去公园' } });
      await page.finish();
      expect(service.create.mock.calls[0][0].awareness.feelings).toEqual(['期待', '感动']);
    });

    test('页面里：只有自己加的词有长按删除；加词小面板的几处都接上了', () => {
      const fs = require('fs');
      const path = require('path');
      const wxml = fs.readFileSync(path.join(__dirname, '../../pages/joy-notes/awareness/awareness.wxml'), 'utf8');
      [
        'bindtap="toggleAddFeeling"',
        'bindinput="onAddInput"',
        'bindconfirm="confirmAddFeeling"',
        'bindtap="confirmAddFeeling"',
        'bindtap="chooseAddGroup"',
        '{{addHint}}',
        '{{hasCustom}}',
        '{{addText}}'
      ].forEach(token => expect(wxml).toContain(token));
      expect(wxml.match(/bindlongpress=/g)).toHaveLength(1);
      const start = wxml.indexOf('wx:if="{{item.custom}}"');
      expect(start).toBeGreaterThan(0);
      const mine = wxml.slice(start, wxml.indexOf('wx:else', start));
      expect(mine).toContain('bindlongpress="removeCustomFeeling"');
      expect(mine).toContain('data-group="{{group.key}}"');
      expect(wxml.match(/<input[\s\S]*?aw-add-input[\s\S]*?\/>/)[0]).toContain('maxlength="8"');
    });
  });

  describe('问：一叩、再叩、三叩', () => {
    const answer = (index, value) => page.onAnswer({ currentTarget: { dataset: { index } }, detail: { value } });

    test('先写这一层，才能往里一层；最多三层；每层缩进编号', () => {
      mount();
      page.deepen();
      expect(page.data.askItems).toHaveLength(1);
      expect(wx.showToast).toHaveBeenCalledWith({ title: '先写一句，再往里一层', icon: 'none' });
      answer(0, '没有先听懂');
      page.deepen();
      answer(1, '他可能想画完');
      page.deepen();
      answer(2, '先问一句');
      page.deepen();
      expect(page.data.askItems.map(item => item.label)).toEqual(['一叩', '再叩', '三叩']);
      expect(page.data.askItems).toHaveLength(3);
      page.data.askItems.forEach(item => expect(item.question.length).toBeGreaterThan(3));
    });

    test('换一问：只在还没写回答时可以换，写了之后不能换，免得问题和回答对不上', () => {
      mount({ periodId: 'p1', sectionId: 's1', source: encodeURIComponent('知彼解己') });
      const first = page.data.askItems[0].question;
      expect(page.data.canSwap).toBe(true);
      page.swapLadder();
      expect(page.data.askItems[0].question).not.toBe(first);
      expect(page.data.ladderVariant).toBe(1);
      answer(0, '写了一点');
      expect(page.data.canSwap).toBe(false);
      const second = page.data.askItems[0].question;
      page.swapLadder();
      expect(page.data.askItems[0].question).toBe(second);
      answer(0, '');
      expect(page.data.canSwap).toBe(true);
    });
  });

  describe('问题跟着心情走', () => {
    const tap = name => page.toggleFeeling({ currentTarget: { dataset: { name } } });
    const answer = (index, value) => page.onAnswer({ currentTarget: { dataset: { index } }, detail: { value } });
    // 从「看」走到「感」，选好词，再进「问」
    const feelThenAsk = (...names) => {
      page.begin();
      page.next();
      names.forEach(tap);
      page.next();
    };

    test('只选了亮一点的：换成「种子」问题链，带上这个词；「择」和「收」的话也跟着换', async () => {
      mount({ periodId: 'p1', sectionId: 's1', source: encodeURIComponent('知彼解己') });
      feelThenAsk('感动');
      expect(page.data.step).toBe('ask');
      expect(page.data).toMatchObject({ ladderKind: 'seed', askLead: '顺着这份感动，找一找心里的种子', canSwap: true });
      expect(page.data.askItems[0].question).toBe('这份感动里，有没有一次「被听懂」，或者「听懂了别人」？');
      answer(0, '孩子说我今天听他把话讲完了');
      page.next();
      expect(page.data.chooseQ).toBe('我想怎样，让这颗种子再长一点？');
      expect(page.data.choosePh).toBe('明天，我想……');
      page.onChoice({ detail: { value: '睡前再听他讲一件学校的事' } });
      await page.finish();
      expect(service.create.mock.calls[0][0].awareness.asks).toEqual([
        { question: '这份感动里，有没有一次「被听懂」，或者「听懂了别人」？', answer: '孩子说我今天听他把话讲完了' }
      ]);
      expect(page.data.step).toBe('done');
      expect(page.data.doneLine).toBe('被看见的种子，会慢慢长大。');
    });

    test('只选了沉一点的：还是原来的问题链，最后一问带上这个词', () => {
      mount();
      feelThenAsk('委屈');
      expect(page.data).toMatchObject({ ladderKind: 'heavy', askLead: '顺着这份委屈，往里看一看' });
      expect(page.data.ladder).toEqual(['那一刻，我最在意的是什么？', '我在保护什么，或者害怕失去什么？', '如果不被这份委屈推着走，我真正想要的是什么？']);
      page.next();
      expect(page.data.chooseQ).toBe('下一次，我想怎样回应？');
      expect(page.data.doneLine).toBe('看见，就是改变的开始。');
    });

    test('两种都有：先看沉的那一条，「换一问」能换到种子', () => {
      mount();
      feelThenAsk('感动', '内疚');
      expect(page.data).toMatchObject({ ladderKind: 'heavy', askLead: '顺着这份内疚，往里看一看' });
      page.swapLadder();
      page.swapLadder();
      expect(page.data).toMatchObject({ ladderKind: 'seed', askLead: '顺着这份感动，找一找心里的种子' });
      expect(page.data.askItems[0].question).toBe('这份感动，是从哪一刻开始的？');
    });

    test('没写回答时回去改心情，问题跟着换；明暗没变只换了词，保留换到的那一条', () => {
      mount();
      feelThenAsk('开心');
      page.swapLadder();
      expect(page.data.ladderVariant).toBe(1);
      page.back();
      tap('开心');
      tap('感动');
      page.next();
      expect(page.data.ladderVariant).toBe(1);
      expect(page.data.askItems[0].question).toBe('这份感动里，我最想记住哪一个画面？');
      page.back();
      tap('感动');
      tap('生气');
      page.next();
      expect(page.data).toMatchObject({ ladderKind: 'heavy', ladderVariant: 0 });
    });

    test('写了回答再回去改心情：问题不跟着换，回答也不丢', () => {
      mount();
      feelThenAsk('开心');
      const question = page.data.askItems[0].question;
      answer(0, '他主动收拾了书包');
      page.back();
      tap('开心');
      tap('生气');
      page.next();
      expect(page.data.ladderKind).toBe('seed');
      expect(page.data.askItems[0]).toMatchObject({ question, answer: '他主动收拾了书包' });
    });

    test('草稿记下出题时的心情，恢复后问题还是那一条', () => {
      mount();
      feelThenAsk('温暖');
      answer(0, '同事帮我带了早饭');
      page.flushDraft();
      expect(store.read(store.KEYS.awarenessDraft).ladderContext).toEqual({ tone: 'bright', heavyWord: '', brightWord: '温暖' });
      page.onUnload();
      mount();
      wx.showModal.mock.calls[0][0].success({ confirm: true });
      expect(page.data.askItems[0]).toMatchObject({ question: '这份温暖，是从哪一刻开始的？', answer: '同事帮我带了早饭' });
      expect(page.data.askLead).toBe('顺着这份温暖，找一找心里的种子');
    });

    test('旧草稿没有记心情：按没选心情出题，和以前出的题一样', () => {
      store.write(store.KEYS.awarenessDraft, {
        version: 1,
        step: 'ask',
        facts: '旧的',
        feelings: ['感动'],
        answers: ['旧的回答'],
        ladderVariant: 0,
        habitKey: 'general'
      });
      mount();
      wx.showModal.mock.calls[0][0].success({ confirm: true });
      expect(page.data.ladderKind).toBe('heavy');
      expect(page.data.askItems[0]).toMatchObject({ question: '那一刻，我最在意的是什么？', answer: '旧的回答' });
    });

    test('「看」里的例子每天固定，难受的事、开心的事轮着出现；这几处的字都从数据里来', () => {
      const q = require('../../utils/awareness-questions');
      mount();
      expect(q.SEE_PLACEHOLDERS).toContain(page.data.seePh);
      const fs = require('fs');
      const path = require('path');
      const wxml = fs.readFileSync(path.join(__dirname, '../../pages/joy-notes/awareness/awareness.wxml'), 'utf8');
      ['{{seePh}}', '{{askLead}}', '{{chooseQ}}', '{{choosePh}}', '{{doneLine}}', '{{feelingGroups}}'].forEach(token => expect(wxml).toContain(token));
      expect(wxml).not.toContain('下一次，我想怎样回应？');
    });
  });

  describe('保存', () => {
    const fill = () => {
      mount({ periodId: 'p1', sectionId: 's1', source: encodeURIComponent('连接之力 · 知彼解己') });
      page.onFacts({ detail: { value: '  孩子磨蹭，我提高了声音。  ' } });
      page.toggleFeeling({ currentTarget: { dataset: { name: '着急' } } });
      page.onFeelingNote({ detail: { value: '有点累' } });
      page.onAnswer({ currentTarget: { dataset: { index: 0 } }, detail: { value: '  没有先听懂他  ' } });
      page.deepen();
      page.onChoice({ detail: { value: '  明天提前十分钟叫他  ' } });
    };

    test('完成：提交整理过的内容和课程，保存后进入「收」，清草稿，让日记页重新读列表', async () => {
      const journal = { route: 'pages/joy-notes/joy-notes', _loadedAt: 123 };
      global.getCurrentPages = jest.fn(() => [journal, {}]);
      fill();
      page.flushDraft();
      expect(store.read(store.KEYS.awarenessDraft)).not.toBe(null);
      await page.finish();
      expect(service.create).toHaveBeenCalledWith({
        kind: 'awareness',
        awareness: {
          facts: '孩子磨蹭，我提高了声音。',
          feelings: ['着急'],
          bodyAreas: [],
          feelingNote: '有点累',
          asks: [{ question: '那一刻，我有没有先听懂对方？', answer: '没有先听懂他' }],
          habitKey: 'habit5',
          choice: '明天提前十分钟叫他'
        },
        revisit: true,
        periodId: 'p1',
        sectionId: 's1'
      });
      expect(page.data.step).toBe('done');
      expect(page.data.noteId).toBe('n1');
      expect(page.data.summary).toMatchObject({ facts: '孩子磨蹭，我提高了声音。', feelings: ['着急'], keyAsk: '没有先听懂他', choice: '明天提前十分钟叫他' });
      expect(page.data.canCheckin).toBe(true);
      expect(store.read(store.KEYS.awarenessDraft)).toBe(null);
      expect(journal._loadedAt).toBe(0);
      // 保存成功后，退出时不会再把草稿写回去
      page.close();
      expect(store.read(store.KEYS.awarenessDraft)).toBe(null);
    });

    test('关掉「一周后来信」或没写「择」时不回访；没有课程时不带课程', async () => {
      fill();
      page.onRevisit({ detail: { value: false } });
      await page.finish();
      expect(service.create.mock.calls[0][0].revisit).toBe(false);

      service.create.mockClear();
      mount();
      page.onFacts({ detail: { value: '只写了事实' } });
      await page.finish();
      expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ revisit: false, periodId: null, sectionId: null }));
      expect(page.data.canCheckin).toBe(false);
    });

    test('全部留空不能完成', async () => {
      mount();
      await page.finish();
      expect(service.create).not.toHaveBeenCalled();
      expect(wx.showToast).toHaveBeenCalledWith({ title: '至少写一句，再完成', icon: 'none' });
    });

    test('保存失败：留在这里，内容和草稿保留，可以再试', async () => {
      fill();
      page.flushDraft();
      service.create.mockRejectedValue({ message: '网络不太好' });
      await page.finish();
      expect(page.data.step).not.toBe('done');
      expect(page.data.saving).toBe(false);
      expect(page.data.facts).toBe('  孩子磨蹭，我提高了声音。  ');
      expect(store.read(store.KEYS.awarenessDraft)).not.toBe(null);
      expect(wx.showToast).toHaveBeenCalledWith({ title: '网络不太好', icon: 'none' });
    });

    test('关联的课程现在不能用了：问一句要不要不关联直接保存', async () => {
      fill();
      service.create.mockRejectedValueOnce({ message: '只能关联已报名且有权限的期次' });
      await page.finish();
      expect(wx.showModal).toHaveBeenCalledTimes(1);
      const dialog = wx.showModal.mock.calls[0][0];
      expect(dialog.confirmText).toBe('不关联保存');
      dialog.success({ confirm: true });
      await Promise.resolve();
      await Promise.resolve();
      expect(service.create).toHaveBeenCalledTimes(2);
      expect(service.create.mock.calls[1][0]).toMatchObject({ periodId: null, sectionId: null });
      expect(page.data.step).toBe('done');
    });

    test('保存中不重复提交', async () => {
      fill();
      let release;
      service.create.mockReturnValue(new Promise(resolve => { release = resolve; }));
      const first = page.finish();
      await page.finish();
      expect(service.create).toHaveBeenCalledTimes(1);
      release({ id: 'n2' });
      await first;
    });
  });

  describe('草稿（只放本机）', () => {
    test('输入后稍等一会儿自动存草稿，并提示「已自动保存」；什么都没写不存', () => {
      mount();
      page.flushDraft();
      expect(store.read(store.KEYS.awarenessDraft)).toBe(null);
      page.begin();
      page.onFacts({ detail: { value: '写到一半' } });
      expect(store.read(store.KEYS.awarenessDraft)).toBe(null);
      jest.advanceTimersByTime(700);
      const draft = store.read(store.KEYS.awarenessDraft);
      expect(draft).toMatchObject({ version: 1, step: 'see', facts: '写到一半' });
      expect(page.data.savedHint).toBe('已自动保存');
      jest.advanceTimersByTime(2000);
      expect(page.data.savedHint).toBe('');
    });

    test('再次进门会问接着写吗：接着写会恢复到上次的那一屏，包括问答和关联', () => {
      mount({ periodId: 'p1', sectionId: 's1', source: encodeURIComponent('知彼解己') });
      page.begin();
      page.onFacts({ detail: { value: '事实' } });
      page.toggleFeeling({ currentTarget: { dataset: { name: '委屈' } } });
      page.enter('ask');
      page.onAnswer({ currentTarget: { dataset: { index: 0 } }, detail: { value: '第一层的回答' } });
      page.deepen();
      page.onAnswer({ currentTarget: { dataset: { index: 1 } }, detail: { value: '第二层的回答' } });
      page.onChoice({ detail: { value: '小动作' } });
      page.onRevisit({ detail: { value: false } });
      page.flushDraft();
      page.onUnload();

      mount();
      expect(wx.showModal).toHaveBeenCalledTimes(1);
      const dialog = wx.showModal.mock.calls[0][0];
      expect(dialog.title).toBe('接着上次写吗？');
      expect(dialog.confirmText).toBe('接着写');
      expect(dialog.cancelText).toBe('重新开始');
      dialog.success({ confirm: true });
      expect(page.data).toMatchObject({
        step: 'ask',
        facts: '事实',
        feelings: ['委屈'],
        choice: '小动作',
        revisit: false,
        periodId: 'p1',
        sectionId: 's1',
        habitKey: 'habit5'
      });
      expect(page.data.askItems.map(item => item.answer)).toEqual(['第一层的回答', '第二层的回答']);
      jest.advanceTimersByTime(30000);
      expect(page.data.step).toBe('ask');
    });

    test('选「重新开始」：旧草稿清掉，从停那一屏开始', () => {
      mount();
      page.begin();
      page.onFacts({ detail: { value: '旧的' } });
      page.flushDraft();
      page.onUnload();
      mount();
      wx.showModal.mock.calls[0][0].success({ confirm: false });
      expect(store.read(store.KEYS.awarenessDraft)).toBe(null);
      expect(page.data.step).toBe('pause');
      expect(page.data.facts).toBe('');
    });

    test('从一条随喜开始、同时还有草稿：问接着写，还是从这句重新开始；选之前不会覆盖旧草稿', () => {
      mount();
      page.begin();
      page.onFacts({ detail: { value: '旧草稿' } });
      page.flushDraft();
      page.onUnload();
      mount({ seed: encodeURIComponent('新的一句') });
      const dialog = wx.showModal.mock.calls[0][0];
      expect(dialog.cancelText).toBe('从这句开始');
      expect(dialog.content).toContain('从这句话重新开始');
      page.onFacts({ detail: { value: '手滑改了' } });
      jest.advanceTimersByTime(2000);
      expect(store.read(store.KEYS.awarenessDraft).facts).toBe('旧草稿');
      dialog.success({ confirm: false });
      expect(page.data.facts).toBe('新的一句');
    });

    test('退出时保存草稿并回到上一页；没有上一页就回日记页', () => {
      mount();
      page.begin();
      page.onFacts({ detail: { value: '先放这里' } });
      global.getCurrentPages = jest.fn(() => [{}, {}]);
      page.close();
      expect(store.read(store.KEYS.awarenessDraft).facts).toBe('先放这里');
      expect(wx.navigateBack).toHaveBeenCalled();
      global.getCurrentPages = jest.fn(() => [{}]);
      page.close();
      expect(wx.redirectTo).toHaveBeenCalledWith({ url: '/pages/joy-notes/joy-notes' });
    });
  });

  describe('收', () => {
    const finished = async (extra = {}) => {
      mount({ periodId: 'p1', sectionId: 's1', source: encodeURIComponent('连接之力 · 知彼解己') });
      page.onFacts({ detail: { value: '孩子磨蹭' } });
      page.onChoice({ detail: { value: extra.choice || '明天提前十分钟叫他' } });
      await page.finish();
    };

    test('做成给自己的日签：用「择」的文字；超过 120 字先提示', async () => {
      await finished();
      page.makeCard();
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: `/pages/daily-card/daily-card?quote=${encodeURIComponent('明天提前十分钟叫他')}` });
      wx.navigateTo.mockClear();
      page.setData({ summary: { choice: '长'.repeat(121) } });
      page.makeCard();
      expect(wx.navigateTo).not.toHaveBeenCalled();
      expect(wx.showToast).toHaveBeenCalled();
    });

    test('发成打卡：写进这一课的打卡草稿（默认仅自己可见，不替用户公开），再打开打卡页', async () => {
      await finished();
      page.postAsCheckin();
      const draft = tenantStorage.get('checkin_draft_u1_s1');
      expect(draft).toMatchObject({ visibility: 'admin', images: [], mood: '' });
      expect(draft.content).toBe('看：孩子磨蹭\n择：明天提前十分钟叫他');
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/checkin/checkin?sectionId=s1&periodId=p1' });
    });

    test('打卡里已有草稿：问接在后面还是不带过去；不带过去也去打卡页、原有草稿不动；接在后面保留原有的图片、心情和可见范围', async () => {
      tenantStorage.set('checkin_draft_u1_s1', { content: '原来的草稿', images: ['a.png'], visibility: 'all', mood: 'calm' });
      await finished();
      page.postAsCheckin();
      expect(wx.navigateTo).not.toHaveBeenCalled();
      const dialog = wx.showModal.mock.calls[0][0];
      expect(dialog.confirmText).toBe('接在后面');
      wx.navigateTo.mockClear();
      dialog.success({ confirm: false });
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/checkin/checkin?sectionId=s1&periodId=p1' });
      expect(tenantStorage.get('checkin_draft_u1_s1').content).toBe('原来的草稿');
      wx.navigateTo.mockClear();
      dialog.success({ confirm: true });
      expect(tenantStorage.get('checkin_draft_u1_s1')).toMatchObject({
        content: '原来的草稿\n\n看：孩子磨蹭\n择：明天提前十分钟叫他',
        images: ['a.png'],
        visibility: 'all',
        mood: 'calm'
      });
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/checkin/checkin?sectionId=s1&periodId=p1' });
    });

    test('没有关联课程就没有「发成打卡」', async () => {
      mount();
      page.onFacts({ detail: { value: '没关联' } });
      await page.finish();
      expect(page.data.canCheckin).toBe(false);
      page.postAsCheckin();
      expect(wx.navigateTo).not.toHaveBeenCalled();
    });

    test('看我的日记：有上一页就返回，没有就跳到日记页', async () => {
      await finished();
      global.getCurrentPages = jest.fn(() => [{}, {}]);
      page.goJournal();
      expect(wx.navigateBack).toHaveBeenCalled();
      global.getCurrentPages = jest.fn(() => [{}]);
      page.goJournal();
      expect(wx.redirectTo).toHaveBeenCalledWith({ url: '/pages/joy-notes/joy-notes' });
    });
  });

  describe('标题与富文本重点颜色', () => {
    const red = '<p>孩子磨蹭，<span style="color:#dc2626">我提高了声音</span></p>';

    test('「看」「问」「择」用输入框组件：带格式时多带一份 HTML，没有格式的请求内容和以前一样', async () => {
      mount({ periodId: 'p1', sectionId: 's1', source: encodeURIComponent('连接之力 · 知彼解己') });
      page.onFacts({ detail: { text: '孩子磨蹭，我提高了声音', html: red } });
      page.onAnswer({ currentTarget: { dataset: { index: 0 } }, detail: { text: '时间', html: '<p><strong>时间</strong></p>' } });
      page.deepen();
      page.onAnswer({ currentTarget: { dataset: { index: 1 } }, detail: { text: '他想画完', html: '' } });
      page.onChoice({ detail: { text: '明天先问一句', html: '<p><u>明天先问一句</u></p>' } });
      await page.finish();
      expect(service.create).toHaveBeenCalledWith({
        kind: 'awareness',
        awareness: {
          facts: '孩子磨蹭，我提高了声音',
          factsHtml: red,
          feelings: [],
          bodyAreas: [],
          feelingNote: '',
          asks: [
            { question: '那一刻，我有没有先听懂对方？', answer: '时间', answerHtml: '<p><strong>时间</strong></p>' },
            { question: '如果我是 TA，那一刻我在经历什么？', answer: '他想画完' }
          ],
          habitKey: 'habit5',
          choice: '明天先问一句',
          choiceHtml: '<p><u>明天先问一句</u></p>'
        },
        revisit: true,
        periodId: 'p1',
        sectionId: 's1'
      });
    });

    test('标题选填：写了才带上；收尾卡片显示标题', async () => {
      mount();
      page.onFacts({ detail: { value: '只写了事实' } });
      page.onTitle({ detail: { value: '  孩子磨蹭的早晨  ' } });
      await page.finish();
      expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ title: '孩子磨蹭的早晨' }));
      expect(page.data.summary.title).toBe('孩子磨蹭的早晨');

      service.create.mockClear();
      mount();
      page.onFacts({ detail: { value: '没有标题' } });
      await page.finish();
      expect(service.create.mock.calls[0][0]).not.toHaveProperty('title');
    });

    test('草稿保存并恢复标题和各处的格式', () => {
      mount({ periodId: 'p1', sectionId: 's1', source: encodeURIComponent('知彼解己') });
      page.begin();
      page.onTitle({ detail: { value: '草稿的标题' } });
      page.onFacts({ detail: { text: '事实', html: red } });
      page.enter('ask');
      page.onAnswer({ currentTarget: { dataset: { index: 0 } }, detail: { text: '回答', html: '<p><strong>回答</strong></p>' } });
      page.onChoice({ detail: { text: '小动作', html: '<p><u>小动作</u></p>' } });
      page.flushDraft();
      const draft = store.read(store.KEYS.awarenessDraft);
      expect(draft).toMatchObject({ title: '草稿的标题', factsHtml: red, answerHtmls: ['<p><strong>回答</strong></p>'], choiceHtml: '<p><u>小动作</u></p>' });
      page.onUnload();

      mount();
      wx.showModal.mock.calls[0][0].success({ confirm: true });
      expect(page.data).toMatchObject({ title: '草稿的标题', factsHtml: red, choiceHtml: '<p><u>小动作</u></p>' });
      expect(page.data.askItems[0]).toMatchObject({ answer: '回答', answerHtml: '<p><strong>回答</strong></p>' });
    });

    test('发成打卡：有标题时标题放在第一行', async () => {
      mount({ periodId: 'p1', sectionId: 's1', source: encodeURIComponent('连接之力 · 知彼解己') });
      page.onFacts({ detail: { value: '孩子磨蹭' } });
      page.onChoice({ detail: { value: '明天提前十分钟叫他' } });
      page.onTitle({ detail: { value: '早晨' } });
      await page.finish();
      page.postAsCheckin();
      expect(tenantStorage.get('checkin_draft_u1_s1').content).toBe('早晨\n看：孩子磨蹭\n择：明天提前十分钟叫他');
    });

    test('页面声明了输入框组件；写字的几处都是 rich-input，标题是单独的输入', () => {
      const fs = require('fs');
      const path = require('path');
      const dir = path.join(__dirname, '../../pages/joy-notes/awareness');
      const json = JSON.parse(fs.readFileSync(path.join(dir, 'awareness.json'), 'utf8'));
      expect(json.usingComponents['rich-input']).toBe('/components/rich-input/rich-input');
      const wxml = fs.readFileSync(path.join(dir, 'awareness.wxml'), 'utf8');
      expect((wxml.match(/<rich-input/g) || []).length).toBe(3);
      expect(wxml).toContain('bindinput="onTitle"');
    });
  });

  describe('分享这一页', () => {
    test('保存之后可以分享：用刚写的内容打开面板（问带层级，标题和格式保留）', async () => {
      mount({ periodId: 'p1', sectionId: 's1', source: encodeURIComponent('连接之力 · 知彼解己') });
      page.onTitle({ detail: { value: '孩子磨蹭的早晨' } });
      page.onFacts({ detail: { text: '事实', html: '<p><strong>事实</strong></p>' } });
      page.onAnswer({ currentTarget: { dataset: { index: 0 } }, detail: { value: '回答' } });
      page.onChoice({ detail: { value: '小动作' } });
      const panel = { open: jest.fn(), getShareConfig: jest.fn(() => null) };
      page.selectComponent = jest.fn(() => panel);
      page.shareNote();
      expect(panel.open).not.toHaveBeenCalled();
      await page.finish();
      page.shareNote();
      const payload = panel.open.mock.calls[0][0];
      expect(payload).toMatchObject({ id: 'n1', kind: 'awareness', title: '孩子磨蹭的早晨', periodLinked: true, sourceLabel: '连接之力 · 知彼解己' });
      expect(payload.awareness).toMatchObject({ facts: '事实', factsHtml: '<p><strong>事实</strong></p>', choice: '小动作' });
      expect(payload.awareness.asks[0]).toMatchObject({ label: '一叩', answer: '回答' });
    });

    test('转发：用面板里的分享信息，取不到就是首页；进来就隐藏转发菜单；结束页有入口', () => {
      wx.hideShareMenu = jest.fn();
      mount();
      expect(wx.hideShareMenu).toHaveBeenCalledWith({ menus: ['shareAppMessage', 'shareTimeline'] });
      const panel = { open: jest.fn(), getShareConfig: jest.fn(() => ({ title: 't', path: '/pages/joy-notes/shared/shared?code=abcd2345' })) };
      page.selectComponent = jest.fn(() => panel);
      expect(page.onShareAppMessage().path).toContain('abcd2345');
      panel.getShareConfig.mockReturnValue(null);
      expect(page.onShareAppMessage().path).toBe('/pages/index/index');
      const fs = require('fs');
      const path = require('path');
      const dir = path.join(__dirname, '../../pages/joy-notes/awareness');
      expect(fs.readFileSync(path.join(dir, 'awareness.wxml'), 'utf8')).toContain('bindtap="shareNote">分享这一页</text>');
      expect(JSON.parse(fs.readFileSync(path.join(dir, 'awareness.json'), 'utf8')).usingComponents['joy-share']).toBeTruthy();
    });
  });
});
