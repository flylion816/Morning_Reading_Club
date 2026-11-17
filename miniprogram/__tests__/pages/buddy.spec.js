jest.mock('../../services/buddy.service', () => ({
  getState: jest.fn(),
  join: jest.fn(),
  cancel: jest.fn(),
  nudge: jest.fn(),
  leave: jest.fn(),
  highFive: jest.fn(),
  gift: jest.fn(),
  giftCustom: jest.fn(),
  getOverview: jest.fn(),
  getSouvenir: jest.fn(),
  rematch: jest.fn(),
  getCandidates: jest.fn(),
  invite: jest.fn(),
  respondInvite: jest.fn(),
  cancelInvite: jest.fn()
}));
jest.mock('../../utils/require-login', () => ({ requireLogin: jest.fn(() => true) }));

let pageConfig;
let page;
let buddyService;
let requireLogin;

function createPage() {
  return {
    ...pageConfig,
    data: JSON.parse(JSON.stringify(pageConfig.data)),
    setData(update, cb) {
      this.data = { ...this.data, ...update };
      if (cb) cb();
    }
  };
}

const paired = {
  state: 'paired',
  buddy: { userId: 'u1', nickname: '小一', avatarUrl: '', readToday: false, checkedInToday: false },
  canNudge: true,
  nudgedToday: false,
  me: { readToday: true, checkedInToday: false }
};

describe('buddy page', () => {
  beforeEach(() => {
    jest.resetModules();
    global.Page = jest.fn(config => {
      pageConfig = config;
      return config;
    });
    buddyService = require('../../services/buddy.service');
    requireLogin = require('../../utils/require-login').requireLogin;
    requireLogin.mockReturnValue(true);
    Object.values(buddyService).forEach(fn => fn.mockReset());
    wx.showToast.mockClear();
    wx.showModal.mockClear();
    require('../../pages/buddy/buddy');
    page = createPage();
  });

  afterEach(() => {
    delete global.Page;
  });

  test('没有 periodId 时给出提示且不请求', () => {
    page.onLoad({});
    expect(buddyService.getState).not.toHaveBeenCalled();
    expect(page.data.loadError).toBeTruthy();
  });

  test('未登录时不请求', () => {
    requireLogin.mockReturnValue(false);
    page.onLoad({ periodId: 'p1' });
    expect(buddyService.getState).not.toHaveBeenCalled();
    expect(page.data.loading).toBe(false);
  });

  test('已配对时展示读伴与两个状态', async () => {
    buddyService.getState.mockResolvedValue(paired);
    page.onLoad({ periodId: 'p1' });
    await Promise.resolve();
    await Promise.resolve();
    expect(page.data.state).toBe('paired');
    expect(page.data.buddyInitial).toBe('小一');
    expect(page.data.canNudge).toBe(true);
    expect(page.data.me.readToday).toBe(true);
  });

  test('加载失败显示页面内错误，重试会再次请求', async () => {
    buddyService.getState.mockRejectedValueOnce(new Error('网络不稳'));
    page.data.periodId = 'p1';
    await page.loadState();
    expect(page.data.loadError).toBe('网络不稳');
    buddyService.getState.mockResolvedValue({ state: 'none' });
    await page.loadState();
    expect(page.data.loadError).toBe('');
    expect(page.data.state).toBe('none');
  });

  test('申请读伴后用返回的状态更新页面', async () => {
    page.data.periodId = 'p1';
    buddyService.join.mockResolvedValue({ state: 'waiting' });
    await page.onJoin();
    await Promise.resolve();
    expect(buddyService.join).toHaveBeenCalledWith('p1');
    expect(page.data.state).toBe('waiting');
  });

  test('轻拍成功后按钮变成今天拍过了', async () => {
    page.data.periodId = 'p1';
    page.data.canNudge = true;
    buddyService.nudge.mockResolvedValue({ ...paired, canNudge: false, nudgedToday: true });
    await page.onNudge();
    await Promise.resolve();
    expect(page.data.nudgedToday).toBe(true);
    expect(page.data.canNudge).toBe(false);
  });

  test('不能轻拍时点击不发请求；轻拍失败提示并刷新', async () => {
    page.data.periodId = 'p1';
    page.data.canNudge = false;
    page.onNudge();
    expect(buddyService.nudge).not.toHaveBeenCalled();

    page.data.canNudge = true;
    buddyService.nudge.mockRejectedValue(new Error('TA 今天已经读过了'));
    buddyService.getState.mockResolvedValue(paired);
    await page.onNudge();
    await Promise.resolve();
    expect(wx.showToast).toHaveBeenCalledWith({ title: 'TA 今天已经读过了', icon: 'none' });
    expect(buddyService.getState).toHaveBeenCalled();
  });

  test('结束读伴需要二次确认', async () => {
    page.data.periodId = 'p1';
    buddyService.leave.mockResolvedValue({ state: 'ended' });
    wx.showModal.mockImplementationOnce(() => {});
    page.onLeave();
    expect(wx.showModal).toHaveBeenCalled();
    expect(buddyService.leave).not.toHaveBeenCalled();
    wx.showModal.mock.calls[0][0].success({ confirm: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(buddyService.leave).toHaveBeenCalledWith('p1');
    expect(page.data.state).toBe('ended');
  });

  test('canJoin 随接口返回写入页面，期次结束时为 false', async () => {
    page.data.periodId = 'p1';
    buddyService.getState.mockResolvedValue({ state: 'ended', canJoin: false });
    await page.loadState();
    expect(page.data.canJoin).toBe(false);
    buddyService.getState.mockResolvedValue({ state: 'ended', canJoin: true });
    await page.loadState();
    expect(page.data.canJoin).toBe(true);
  });

  test('取消等待', async () => {
    page.data.periodId = 'p1';
    buddyService.cancel.mockResolvedValue({ state: 'none' });
    await page.onCancel();
    await Promise.resolve();
    expect(page.data.state).toBe('none');
  });
  describe('升级后的读伴页', () => {
    const flush = async () => { for (let i = 0; i < 4; i += 1) await Promise.resolve(); };

    test('同行卡用一句话描述双方今天的状态，两人都读完时连线亮起', async () => {
      buddyService.getOverview.mockResolvedValue(null);
      page.applyState({
        ...paired,
        periodName: '连接之力',
        pairedDay: 2,
        buddy: { ...paired.buddy, readToday: true, checkedInToday: true },
        me: { readToday: true, checkedInToday: false },
        bothDone: true,
        canHighFive: true
      });
      expect(page.data.periodName).toBe('连接之力');
      expect(page.data.pairedDay).toBe(2);
      expect(page.data.meLine).toBe('读完了');
      expect(page.data.buddyLine).toBe('读完 · 已打卡');
      expect(page.data.heroNote).toBe('今天你们都读完了，击个掌吧');
    });

    test('只有一方读完时，提示对应的下一步', () => {
      buddyService.getOverview.mockResolvedValue(null);
      page.applyState({ ...paired, canNudge: true });
      expect(page.data.heroNote).toBe('你先到了，轻轻拍一下 TA');
      page.applyState({ ...paired, canNudge: false, nudgedToday: true });
      expect(page.data.heroNote).toBe('已经拍过了，TA 会收到');
      page.applyState({ ...paired, me: { readToday: false }, buddy: { ...paired.buddy, readToday: true } });
      expect(page.data.heroNote).toBe('小一读完了，在等你');
      page.applyState({ ...paired, me: { readToday: false } });
      expect(page.data.heroNote).toBe('今天还没有人读，先读一会儿吧');
    });

    test('轻拍用选中的那句话', async () => {
      page.data.periodId = 'p1';
      page.data.canNudge = true;
      buddyService.getOverview.mockResolvedValue(null);
      buddyService.nudge.mockResolvedValue({ ...paired, canNudge: false, nudgedToday: true });
      page.onSelectNudge({ currentTarget: { dataset: { key: 'slow' } } });
      await page.onNudge();
      expect(buddyService.nudge).toHaveBeenCalledWith('p1', 'slow');
    });

    test('击掌：只有可以击掌时才请求，成功后按钮消失', async () => {
      page.data.periodId = 'p1';
      page.data.canHighFive = false;
      page.onHighFive();
      expect(buddyService.highFive).not.toHaveBeenCalled();

      page.data.canHighFive = true;
      buddyService.getOverview.mockResolvedValue(null);
      buddyService.highFive.mockResolvedValue({ ...paired, bothDone: true, canHighFive: false, highFivedToday: true });
      await page.onHighFive();
      expect(buddyService.highFive).toHaveBeenCalledWith('p1');
      expect(page.data.highFivedToday).toBe(true);
      expect(page.data.canHighFive).toBe(false);
    });

    test('送一句：打开弹层、选句、送出，每天只送一句', async () => {
      page.data.periodId = 'p1';
      page.data.canGift = false;
      page.onOpenGift();
      expect(page.data.giftSheetVisible).toBe(false);

      page.data.canGift = true;
      page.onOpenGift();
      expect(page.data.giftSheetVisible).toBe(true);
      page.onSelectGift({ currentTarget: { dataset: { key: 'noRush' } } });
      buddyService.getOverview.mockResolvedValue(null);
      buddyService.gift.mockResolvedValue({ ...paired, canGift: false, giftSentToday: '不用赶，我在这儿。' });
      await page.onSendGift();
      expect(buddyService.gift).toHaveBeenCalledWith('p1', 'noRush');
      expect(page.data.giftSheetVisible).toBe(false);
      expect(page.data.canGift).toBe(false);
      expect(page.data.giftSentToday).toBe('不用赶，我在这儿。');
    });

    test('送一句的预设短句用状态里今天的四句；没有时退回原来的四句', () => {
      expect(page.data.giftOptions.map(o => o.key)).toEqual(['here', 'reread', 'noRush', 'tomorrow']);
      const today = [
        { key: 'here2', text: '知道你也在读，我就安心了。' },
        { key: 'reread3', text: '读你写的字，我慢了下来。' },
        { key: 'noRush4', text: '累了就歇一歇，明天再读。' },
        { key: 'tomorrow5', text: '睡个好觉，明早见。' }
      ];
      page.applyState({ ...paired, canGift: true, giftOptions: today });
      expect(page.data.giftOptions).toEqual(today);
      // 选中的那句不在今天的列表里（隔天重新打开），退回第一句；还在列表里就保留
      expect(page.data.giftKey).toBe('here2');
      page.onSelectGift({ currentTarget: { dataset: { key: 'noRush4' } } });
      page.applyState({ ...paired, canGift: true, giftOptions: today });
      expect(page.data.giftKey).toBe('noRush4');
      page.applyState({ ...paired, canGift: true });
      expect(page.data.giftOptions.map(o => o.key)).toEqual(['here', 'reread', 'noRush', 'tomorrow']);
      expect(page.data.giftKey).toBe('here');
    });

    test('今天已经送过（状态里不能再送）时，打开着的弹层跟着收起', () => {
      page.applyState({ ...paired, canGift: true });
      page.onOpenGift();
      expect(page.data.giftSheetVisible).toBe(true);
      page.applyState({ ...paired, canGift: true });
      expect(page.data.giftSheetVisible).toBe(true);
      page.applyState({ ...paired, canGift: false, giftSentToday: '不用赶，我在这儿。' });
      expect(page.data.giftSheetVisible).toBe(false);
    });

    describe('自己写一句', () => {
      const flush = () => new Promise(resolve => setImmediate(resolve));

      beforeEach(() => {
        page.data.periodId = 'p1';
        page.data.canGift = true;
        page.data.buddy = paired.buddy;
        page.onOpenGift();
        buddyService.getOverview.mockResolvedValue(null);
      });

      test('聚焦输入框时预设不再高亮；写了内容算自己写的；只有空白不算；清空后回到预设', () => {
        page.onGiftFocus();
        expect(page.data.giftFocus).toBe(true);
        page.onGiftInput({ detail: { value: '  今天也在读  ' } });
        expect(page.data).toMatchObject({ giftText: '  今天也在读  ', giftCount: 9, giftCustom: true });
        page.onGiftInput({ detail: { value: '   ' } });
        expect(page.data.giftCustom).toBe(false);
        page.onGiftBlur();
        expect(page.data.giftFocus).toBe(false);
      });

      test('选预设会清掉写的话并收起键盘', () => {
        wx.hideKeyboard = jest.fn();
        page.onGiftFocus();
        page.onGiftInput({ detail: { value: '想说的话' } });
        page.onSelectGift({ currentTarget: { dataset: { key: 'reread' } } });
        expect(page.data).toMatchObject({ giftKey: 'reread', giftText: '', giftCount: 0, giftCustom: false, giftFocus: false });
        expect(wx.hideKeyboard).toHaveBeenCalledTimes(1);
        // 键盘本来就没开时不用再收
        page.onSelectGift({ currentTarget: { dataset: { key: 'noRush' } } });
        expect(wx.hideKeyboard).toHaveBeenCalledTimes(1);
        delete wx.hideKeyboard;
      });

      test('写了内容就送自己写的话：送出后关弹层、清空输入，状态更新', async () => {
        page.onGiftInput({ detail: { value: ' 今天也在读 ' } });
        buddyService.giftCustom.mockResolvedValue({ ...paired, canGift: false, giftSentToday: '今天也在读' });
        await page.onSendGift();
        expect(buddyService.giftCustom).toHaveBeenCalledWith('p1', '今天也在读');
        expect(buddyService.gift).not.toHaveBeenCalled();
        expect(page.data).toMatchObject({
          giftSheetVisible: false,
          giftText: '',
          giftCustom: false,
          canGift: false,
          giftSentToday: '今天也在读',
          busy: false
        });
        expect(wx.showToast).toHaveBeenCalledWith({ title: '已送出', icon: 'none' });
      });

      test('没写内容就送选中的预设句，不走自己写的那条路', async () => {
        page.onSelectGift({ currentTarget: { dataset: { key: 'noRush' } } });
        buddyService.gift.mockResolvedValue({ ...paired, canGift: false, giftSentToday: '不用赶，我在这儿。' });
        await page.onSendGift();
        expect(buddyService.gift).toHaveBeenCalledWith('p1', 'noRush');
        expect(buddyService.giftCustom).not.toHaveBeenCalled();
      });

      test('内容没通过检查：提示服务端给的原因，弹层和写的话都留着，悄悄刷新状态', async () => {
        page.onGiftInput({ detail: { value: '不行的话' } });
        buddyService.giftCustom.mockRejectedValue({ statusCode: 400, message: '这句话暂时送不出去，换一句试试' });
        buddyService.getState.mockResolvedValue({ ...paired, canGift: true });
        await page.onSendGift();
        await flush();
        expect(wx.showToast).toHaveBeenCalledWith({ title: '这句话暂时送不出去，换一句试试', icon: 'none' });
        expect(page.data).toMatchObject({ giftSheetVisible: true, giftText: '不行的话', giftCustom: true, busy: false });
        expect(buddyService.getState).toHaveBeenCalledWith('p1');
        expect(page.data.loading).toBe(false);
      });

      test('检查服务不可用（503）：换成能看懂的提示，弹层和写的话留着', async () => {
        page.onGiftInput({ detail: { value: '想说的话' } });
        buddyService.giftCustom.mockRejectedValue({ statusCode: 503, message: '服务器开小差了，稍后再试试' });
        buddyService.getState.mockResolvedValue({ ...paired, canGift: true });
        await page.onSendGift();
        await flush();
        expect(wx.showToast).toHaveBeenCalledWith({ title: '暂时没法送自己写的话，先选一句预设的吧', icon: 'none' });
        expect(page.data).toMatchObject({ giftSheetVisible: true, giftText: '想说的话', busy: false });
      });

      test('刷新发现今天已经送过一句：弹层收起', async () => {
        page.onGiftInput({ detail: { value: '想说的话' } });
        buddyService.giftCustom.mockRejectedValue({ statusCode: 400, message: '今天已经送过一句了' });
        buddyService.getState.mockResolvedValue({ ...paired, canGift: false, giftSentToday: '不用赶，我在这儿。' });
        await page.onSendGift();
        await flush();
        expect(wx.showToast).toHaveBeenCalledWith({ title: '今天已经送过一句了', icon: 'none' });
        expect(page.data.giftSheetVisible).toBe(false);
      });

      test('正在送出时不会重复提交；什么都没选也没写时提示', async () => {
        page.data.busy = true;
        page.onGiftInput({ detail: { value: '想说的话' } });
        await page.onSendGift();
        expect(buddyService.giftCustom).not.toHaveBeenCalled();

        page.data.busy = false;
        page.onGiftInput({ detail: { value: '' } });
        page.data.giftKey = '';
        await page.onSendGift();
        expect(wx.showToast).toHaveBeenCalledWith({ title: '选一句，或者写一句', icon: 'none' });
        expect(buddyService.gift).not.toHaveBeenCalled();
        expect(buddyService.giftCustom).not.toHaveBeenCalled();
      });

      test('弹层随键盘抬起，收起键盘或关闭弹层时回到原位', () => {
        page.onGiftKeyboardHeight({ detail: { height: 300 } });
        expect(page.data.giftKeyboardHeight).toBe(300);
        page.onGiftKeyboardHeight({ detail: { height: 0 } });
        expect(page.data.giftKeyboardHeight).toBe(0);
        page.onGiftKeyboardHeight({ detail: { height: 280 } });
        page.onGiftFocus();
        page.onCloseGift();
        expect(page.data).toMatchObject({ giftSheetVisible: false, giftKeyboardHeight: 0, giftFocus: false });
      });

      test('弹层模板：输入框随键盘抬起；预设只在没写、没聚焦时高亮；自己写的话有字数提示', () => {
        const wxml = require('fs').readFileSync(require('path').join(__dirname, '../../pages/buddy/buddy.wxml'), 'utf8');
        const sheet = wxml.slice(wxml.indexOf('<!-- 送一句 -->'));
        expect(sheet).toContain('style="margin-bottom: {{giftKeyboardHeight}}px;"');
        const textarea = sheet.match(/<textarea[\s\S]*?\/>/)[0];
        expect(textarea).toContain('adjust-position="{{false}}"');
        expect(textarea).toContain('maxlength="{{giftTextMax}}"');
        expect(textarea).toContain('bindkeyboardheightchange="onGiftKeyboardHeight"');
        expect(sheet).toContain('!giftCustom && !giftFocus && giftKey === item.key');
        expect(sheet).toContain('{{giftCount}}/{{giftTextMax}}');
      });
    });

    test('已配对时加载足迹，TA 的打卡带上心情名', async () => {
      page.data.periodId = 'p1';
      buddyService.getOverview.mockResolvedValue({
        sharedDays: 2,
        trail: [{ day: 1, dayKey: '2026-11-08', status: 'both' }],
        timeline: [{ type: 'paired', date: '2026-11-08', text: '你们成为读伴' }],
        publicCheckins: [{ checkinId: 'c1', sectionId: 's1', mood: 'calm' }, { checkinId: 'c2', sectionId: 's2' }],
        publicInsights: []
      });
      page.applyState(paired);
      await flush();
      expect(page.data.overview.sharedDays).toBe(2);
      expect(page.data.overview.publicCheckins[0].moodName).toBe('多云');
      expect(page.data.overview.publicCheckins[1].moodName).toBe('');
    });

    test('已结束时加载纪念，续伴后更新意愿', async () => {
      page.data.periodId = 'p1';
      buddyService.getSouvenir.mockResolvedValue({ togetherDays: 5, canRematch: true, rematch: { mine: false, both: false } });
      page.applyState({ state: 'ended', canJoin: false });
      await flush();
      expect(page.data.souvenir.togetherDays).toBe(5);

      buddyService.rematch.mockResolvedValue({ togetherDays: 5, canRematch: false, rematch: { mine: true, both: false } });
      await page.onRematch();
      expect(buddyService.rematch).toHaveBeenCalledWith('p1');
      expect(page.data.souvenir.rematch.mine).toBe(true);
      expect(page.data.souvenir.canRematch).toBe(false);
    });

    test('TA 的新打卡带小圆点，回应过的带上回应的那句话', async () => {
      page.data.periodId = 'p1';
      buddyService.getOverview.mockResolvedValue({
        sharedDays: 0,
        reactionCount: 1,
        publicCheckins: [
          { checkinId: 'c1', sectionId: 's1', isNew: true, myReaction: '' },
          { checkinId: 'c2', sectionId: 's2', isNew: false, myReaction: '谢谢你写下来。' }
        ],
        publicInsights: []
      });
      page.applyState(paired);
      await flush();
      expect(page.data.overview.publicCheckins[0].isNew).toBe(true);
      expect(page.data.overview.publicCheckins[1].myReaction).toBe('谢谢你写下来。');
    });

    test('选人：打开弹层加载本期学员，邀请后标为已邀请；对方先邀请过则直接结成', async () => {
      page.data.periodId = 'p1';
      page.data.canJoin = true;
      buddyService.getCandidates.mockResolvedValue({ list: [{ userId: 'u3', nickname: '小三', invited: false }] });
      await page.onOpenPicker();
      expect(page.data.pickerVisible).toBe(true);
      expect(page.data.candidates[0].nickname).toBe('小三');

      buddyService.invite.mockResolvedValue({ state: 'none', canJoin: true, invitesSent: [{ inviteId: 'i1', nickname: '小三' }] });
      await page.onInvite({ currentTarget: { dataset: { userId: 'u3' } } });
      expect(buddyService.invite).toHaveBeenCalledWith('p1', 'u3');
      expect(page.data.candidates[0].invited).toBe(true);
      expect(page.data.invitesSent).toHaveLength(1);

      buddyService.getOverview.mockResolvedValue(null);
      buddyService.invite.mockResolvedValue({ ...paired });
      await page.onInvite({ currentTarget: { dataset: { userId: 'u4' } } });
      expect(page.data.state).toBe('paired');
      expect(page.data.pickerVisible).toBe(false);
    });

    test('已经没有读伴名额（期次结束）时不能打开选人', async () => {
      page.data.canJoin = false;
      await page.onOpenPicker();
      expect(page.data.pickerVisible).toBe(false);
    });

    test('收到的邀请：同意后结成读伴，婉拒后邀请消失；撤回我发出的邀请', async () => {
      page.data.periodId = 'p1';
      buddyService.getOverview.mockResolvedValue(null);
      buddyService.respondInvite.mockResolvedValue({ ...paired });
      await page.onRespondInvite({ currentTarget: { dataset: { inviteId: 'i1', accept: true } } });
      expect(buddyService.respondInvite).toHaveBeenCalledWith('p1', 'i1', true);
      expect(page.data.state).toBe('paired');

      buddyService.respondInvite.mockResolvedValue({ state: 'none', invitesReceived: [] });
      await page.onRespondInvite({ currentTarget: { dataset: { inviteId: 'i2', accept: false } } });
      expect(buddyService.respondInvite).toHaveBeenLastCalledWith('p1', 'i2', false);
      expect(page.data.invitesReceived).toEqual([]);

      buddyService.cancelInvite.mockResolvedValue({ state: 'none', invitesSent: [] });
      await page.onCancelInvite({ currentTarget: { dataset: { inviteId: 'i3' } } });
      expect(buddyService.cancelInvite).toHaveBeenCalledWith('p1', 'i3');
    });

    test('没有读伴时显示还有几位书友在等', () => {
      page.applyState({ state: 'none', canJoin: true, waitingCount: 3 });
      expect(page.data.waitingCount).toBe(3);
    });
  });
  describe('邀请的优化', () => {
    test('名单翻页：下滑加载下一页并接在后面；搜索回到第一页', async () => {
      page.data.periodId = 'p1';
      page.data.canJoin = true;
      buddyService.getCandidates.mockResolvedValueOnce({ list: [{ userId: 'a', nickname: '甲', streak: 5 }], hasMore: true });
      await page.onOpenPicker();
      expect(buddyService.getCandidates).toHaveBeenLastCalledWith('p1', '', 1);
      expect(page.data.candidatesHasMore).toBe(true);
      expect(page.data.candidates[0].hint).toBe('已连续读 5 天');

      buddyService.getCandidates.mockResolvedValueOnce({ list: [{ userId: 'b', nickname: '乙', waiting: true }, { userId: 'c', nickname: '丙', recentlyActive: true }], hasMore: false });
      await page.onCandidatesMore();
      expect(buddyService.getCandidates).toHaveBeenLastCalledWith('p1', '', 2);
      expect(page.data.candidates.map(c => c.userId)).toEqual(['a', 'b', 'c']);
      expect(page.data.candidates.map(c => c.hint)).toEqual(['已连续读 5 天', '也在找读伴', '最近读过']);
      expect(page.data.candidatesHasMore).toBe(false);

      buddyService.getCandidates.mockResolvedValueOnce({ list: [], hasMore: false });
      page.setData({ pickerKeyword: '乙' });
      await page.onPickerSearch();
      expect(buddyService.getCandidates).toHaveBeenLastCalledWith('p1', '乙', 1);
      expect(page.data.candidates).toEqual([]);
    });

    test('没有下一页时下滑不再请求', async () => {
      page.data.periodId = 'p1';
      page.data.candidatesHasMore = false;
      buddyService.getCandidates.mockClear();
      await page.onCandidatesMore();
      expect(buddyService.getCandidates).not.toHaveBeenCalled();
    });

    test('被婉拒的邀请显示结果，不能撤回；开关调用设置接口，失败时还原', async () => {
      page.applyState({ state: 'none', canJoin: true, discoverable: false, invitesSent: [{ inviteId: 'i1', nickname: '乙', status: 'declined' }, { inviteId: 'i2', nickname: '丙', status: 'pending' }] });
      expect(page.data.invitesSent.map(i => i.declined)).toEqual([true, false]);
      expect(page.data.discoverable).toBe(false);

      buddyService.setDiscoverable = jest.fn().mockResolvedValue({ discoverable: true });
      await page.onToggleDiscoverable();
      expect(buddyService.setDiscoverable).toHaveBeenCalledWith(true);
      expect(page.data.discoverable).toBe(true);

      buddyService.setDiscoverable.mockRejectedValue(new Error('网络不稳'));
      await page.onToggleDiscoverable();
      expect(page.data.discoverable).toBe(true);
    });

    test('在读伴页做了互动，会通知首页回去重新取读伴状态', async () => {
      page.data.periodId = 'p1';
      global.getApp = jest.fn(() => ({ globalData: {} }));
      const app = global.getApp();
      global.getApp = jest.fn(() => app);
      buddyService.cancel.mockResolvedValue({ state: 'none' });
      await page.onCancel();
      expect(app.globalData.buddyDirty).toBe(true);
      delete global.getApp;
    });
  });
});
