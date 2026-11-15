const { buildFeed, summarizeFeed, dayLabel, parseQuoted, periodFromTitle } = require('../../pages/notifications/notification-feed');

const NOW = new Date('2026-11-15T12:00:00+08:00');
const at = (iso) => new Date(iso).toISOString();

function n(overrides = {}) {
  return {
    _id: overrides._id || `n_${Math.random().toString(36).slice(2, 8)}`,
    type: 'like_received',
    isRead: false,
    createdAt: at('2026-11-15T10:00:00+08:00'),
    senderName: '王可心',
    senderUserId: 'u_wang',
    senderAvatar: '',
    senderAvatarText: '可心',
    senderAvatarColor: '#999',
    formattedTime: '2 小时前',
    actionText: '查看打卡详情',
    resolvedTargetPage: 'pages/course-detail/course-detail?id=s1',
    data: {},
    ...overrides
  };
}

const flat = groups => groups.reduce((all, g) => all.concat(g.items), []);

describe('notification-feed 来信', () => {
  test('日期分组：今天 / 昨天 / 更早', () => {
    expect(dayLabel(at('2026-11-15T08:00:00+08:00'), NOW)).toBe('今天');
    expect(dayLabel(at('2026-11-14T23:00:00+08:00'), NOW)).toBe('昨天');
    expect(dayLabel(at('2026-11-10T08:00:00+08:00'), NOW)).toBe('更早');
    const groups = buildFeed([
      n({ _id: 'a', senderName: '甲', senderUserId: 'a' }),
      n({ _id: 'b', createdAt: at('2026-11-14T09:00:00+08:00'), type: 'letter_delivered', senderName: '' }),
      n({ _id: 'c', createdAt: at('2026-11-01T09:00:00+08:00'), type: 'enrollment_result', content: '「连接之力」报名成功', senderName: '' })
    ], NOW);
    expect(groups.map(g => g.label)).toEqual(['今天', '昨天', '更早']);
  });

  test('同一篇打卡、同一天的点赞合并成一条，头像叠两个，名字最多写两个', () => {
    const likes = ['王可心', '林泰君', '赵敏慧', '张敏'].map((name, i) =>
      n({ _id: `l${i}`, senderName: name, senderUserId: `u${i}`, data: { checkinId: 'c1', sectionTitle: '开营词' } })
    );
    const items = flat(buildFeed(likes, NOW));
    expect(items).toHaveLength(1);
    expect(items[0].ids).toEqual(['l0', 'l1', 'l2', 'l3']);
    expect(items[0].lead).toBe('王可心、林泰君 等 4 位书友');
    expect(items[0].rest).toBe(' 给你的《开营词》点了赞');
    expect(items[0].avatars).toHaveLength(2);
  });

  test('不同打卡的赞、评论的赞、评论本身都不合并', () => {
    const items = flat(buildFeed([
      n({ _id: 'a', data: { checkinId: 'c1' } }),
      n({ _id: 'b', senderUserId: 'u2', data: { checkinId: 'c2' } }),
      n({ _id: 'c', senderUserId: 'u3', data: { checkinId: 'c1', commentId: 'm1' } }),
      n({ _id: 'd', type: 'comment_received', senderUserId: 'u4', data: { checkinId: 'c1', commentPreview: '早起的人最有福气。' } }),
      n({ _id: 'e', type: 'comment_received', senderUserId: 'u5', data: { checkinId: 'c1', commentPreview: '一起加油。' } })
    ], NOW));
    expect(items).toHaveLength(5);
    expect(items.find(i => i.ids[0] === 'c').rest).toBe(' 给你的评论点了赞');
  });

  test('评论把那句话引出来，并且算「等我回应」', () => {
    const [item] = flat(buildFeed([n({ type: 'comment_received', data: { checkinId: 'c1', commentPreview: '早起的人最有福气。' } })], NOW));
    expect(item.rest).toBe(' 在你的打卡下留了一句');
    expect(item.quote).toBe('早起的人最有福气。');
    expect(item.needsReply).toBe(true);
    expect(item.badge).toBe('评');
  });

  test('读伴的点赞、评论、回应在同一篇打卡上合并成一条暖色来信', () => {
    const items = flat(buildFeed([
      n({ _id: 'r', type: 'buddy_reaction', senderName: '喜娟', senderUserId: 'u_buddy', title: '你的读伴回应了你的打卡 · 连接之力', content: '喜娟：「这句也打动我。」', data: { checkinId: 'c1' } }),
      n({ _id: 'c', type: 'comment_received', senderName: '喜娟', senderUserId: 'u_buddy', data: { checkinId: 'c1', fromBuddy: true, commentPreview: '我抄在本子上了。' } }),
      n({ _id: 'l', type: 'like_received', senderName: '喜娟', senderUserId: 'u_buddy', data: { checkinId: 'c1', fromBuddy: true } })
    ], NOW));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      warm: true,
      badge: '伴',
      lead: '你的读伴 喜娟',
      rest: ' 读了你的打卡，点了赞，还回应了一句，还留了一句',
      quote: '这句也打动我。',
      period: '连接之力'
    });
    expect(items[0].ids).toEqual(['r', 'c', 'l']);
  });

  test('读伴的点赞和普通书友的点赞不会合并到一起', () => {
    const items = flat(buildFeed([
      n({ _id: 'a', senderName: '喜娟', senderUserId: 'u_buddy', data: { checkinId: 'c1', fromBuddy: true } }),
      n({ _id: 'b', senderName: '林泰君', senderUserId: 'u_lin', data: { checkinId: 'c1' } })
    ], NOW));
    expect(items).toHaveLength(2);
    expect(items.map(i => i.warm).sort()).toEqual([false, true]);
  });

  test('读伴的轻拍、击掌、送一句、写打卡各自一条，期次名取自标题', () => {
    const base = { senderName: '喜娟', senderUserId: 'u_buddy', title: '你的读伴轻拍了你一下 · 连接之力' };
    // 不同的日子各发一条，所以各自一张（同一天的会合并，见下一条）
    const day = d => at(`2026-11-${d}T09:00:00+08:00`);
    const items = flat(buildFeed([
      n({ ...base, _id: '1', type: 'buddy_nudge', content: '喜娟在等你一起读', createdAt: day('15') }),
      n({ ...base, _id: '2', type: 'buddy_nudge', content: '喜娟说不急，慢慢来', createdAt: day('14') }),
      n({ ...base, _id: '3', type: 'buddy_highfive', content: '喜娟说：今天我们都读完了', createdAt: day('13') }),
      n({ ...base, _id: '4', type: 'buddy_gift', content: '喜娟：「不用赶，我在这儿。」', createdAt: day('12') }),
      n({ ...base, _id: '5', type: 'buddy_checkin', data: { sectionTitle: '品德成功论' }, createdAt: day('11') })
    ], NOW));
    expect(items.map(i => i.quote)).toEqual(['在等你一起读', '不急，慢慢来', '', '不用赶，我在这儿。', '']);
    expect(items[2].rest).toBe(' 和你击了个掌');
    expect(items[4].rest).toBe(' 写下了「品德成功论」的打卡');
    expect(items.every(i => i.warm && i.period === '连接之力')).toBe(true);
  });

  test('系统类消息用印章字，没有头像', () => {
    const items = flat(buildFeed([
      n({ _id: 'a', type: 'insight_created', senderName: '', data: { sectionTitle: '第一天 品德成功论' } }),
      n({ _id: 'b', type: 'letter_delivered', senderName: '' }),
      n({ _id: 'c', type: 'enrollment_result', senderName: '', content: '「连接之力」报名成功' })
    ], NOW));
    expect(items.map(i => i.sealChar)).toEqual(['凡', '信', '营']);
    expect(items[0].rest).toBe('小凡读了你的《第一天 品德成功论》，写下了看见');
    expect(items.every(i => i.avatars.length === 0)).toBe(true);
  });

  test('申请看见：带上申请 ID，可以直接处理，并算「等我回应」', () => {
    const [item] = flat(buildFeed([
      n({ type: 'request_created', senderName: '张敏', requestIdValue: 'req1', periodIdValue: 'p1' })
    ], NOW));
    expect(item.rest).toBe(' 想读读你的小凡看见');
    expect(item.request).toEqual({ requestId: 'req1', status: 'pending' });
    expect(item.periodId).toBe('p1');
    expect(item.needsReply).toBe(true);
  });

  test('顶部汇总：几位书友想到了你、几件事等你回应、没有未读时说安静', () => {
    const groups = buildFeed([
      n({ _id: 'a', type: 'request_created', senderName: '张敏', senderUserId: 'u_zhang', requestIdValue: 'r1' }),
      n({ _id: 'b', senderName: '喜娟', senderUserId: 'u_buddy', type: 'buddy_nudge', content: '喜娟在等你一起读' }),
      n({ _id: 'c', type: 'letter_delivered', senderName: '' })
    ], NOW);
    const summary = summarizeFeed(groups);
    expect(summary.headline).toBe('今天有 2 位书友想到了你');
    expect(summary.sub).toBe('还有 1 件事在等你回应');
    expect(summary.avatars).toHaveLength(2);
    expect(summary.unreadCount).toBe(3);

    const quiet = summarizeFeed(buildFeed([n({ isRead: true })], NOW));
    expect(quiet.headline).toBe('这会儿很安静');
    expect(summarizeFeed([]).headline).toBe('这会儿很安静');
  });

  test('合并后的来信，只要有一条没读就算未读', () => {
    const [item] = flat(buildFeed([
      n({ _id: 'a', isRead: true, data: { checkinId: 'c1' } }),
      n({ _id: 'b', isRead: false, senderUserId: 'u2', data: { checkinId: 'c1' } })
    ], NOW));
    expect(item.unread).toBe(true);
  });

  test('小工具：引号里的话、标题里的期次名', () => {
    expect(parseQuoted('喜娟：「不用赶。」')).toBe('不用赶。');
    expect(parseQuoted('没有引号')).toBe('');
    expect(periodFromTitle('你的读伴轻拍了你一下 · 连接之力')).toBe('连接之力');
    expect(periodFromTitle('有书友给你点了赞')).toBe('');
  });

  test('读伴邀请：待回复可以直接同意，处理过的显示结果，被同意的通知是暖色卡片', () => {
    const base = { senderName: '喜娟', senderUserId: 'u_buddy', title: '有书友邀请你做读伴 · 连接之力' };
    const items = flat(buildFeed([
      n({ ...base, _id: 'i1', type: 'buddy_invite', data: { inviteId: 'iv1', periodId: 'p1', inviteStatus: 'pending' } }),
      n({ ...base, _id: 'i2', type: 'buddy_invite', senderUserId: 'u2', data: { inviteId: 'iv2', periodId: 'p1', inviteStatus: 'accepted' } }),
      n({ ...base, _id: 'i3', type: 'buddy_invite', senderUserId: 'u3', data: { inviteId: 'iv3', periodId: 'p1', inviteStatus: 'cancelled' } }),
      n({ ...base, _id: 'i4', type: 'buddy_invite_accepted', senderUserId: 'u4', title: '你的读伴邀请被同意了 · 连接之力', data: {} })
    ], NOW));
    expect(items[0]).toMatchObject({ warm: true, badge: '伴', lead: '喜娟', rest: ' 邀请你做读伴', needsReply: true, period: '连接之力' });
    expect(items[0].invite).toEqual({ inviteId: 'iv1', periodId: 'p1', status: 'pending' });
    expect(items[1].invite.status).toBe('accepted');
    expect(items[1].needsReply).toBe(false);
    expect(items[2].needsReply).toBe(false);
    expect(items[3].rest).toBe(' 同意了你的邀请，你们成为读伴了');
    expect(items[3].invite).toBeNull();
  });
  test('同一位读伴同一天的轻拍、击掌、送一句、写打卡，合并成一条；隔天或不同读伴不合并', () => {
    const base = { senderName: '喜娟', senderUserId: 'u_buddy', title: '你的读伴轻拍了你一下 · 连接之力' };
    const items = flat(buildFeed([
      n({ ...base, _id: '1', type: 'buddy_checkin', data: { sectionTitle: '品德成功论' } }),
      n({ ...base, _id: '2', type: 'buddy_gift', content: '喜娟：「不用赶，我在这儿。」' }),
      n({ ...base, _id: '3', type: 'buddy_nudge', content: '喜娟在等你一起读' }),
      n({ ...base, _id: '4', type: 'buddy_highfive', content: '喜娟说：今天我们都读完了' }),
      n({ ...base, _id: '5', type: 'buddy_nudge', content: '喜娟在等你一起读', createdAt: at('2026-11-14T09:00:00+08:00') }),
      n({ ...base, _id: '6', type: 'buddy_nudge', senderName: '另一位', senderUserId: 'u_other', content: '另一位在等你一起读' })
    ], NOW));
    expect(items).toHaveLength(3);
    const merged = items.find(i => i.ids.length === 4);
    expect(merged.ids).toEqual(['1', '2', '3', '4']);
    expect(merged.lead).toBe('你的读伴 喜娟');
    expect(merged.rest).toBe(' 今天写下了今天的打卡，送了你一句话，轻拍了你，和你击了个掌');
    expect(merged.quote).toBe('不用赶，我在这儿。');
  });

  test('读伴结束：不写是谁结束的，用印章字；邀请过期显示已失效', () => {
    const items = flat(buildFeed([
      n({ _id: 'e', type: 'buddy_ended', senderName: '喜娟', senderUserId: 'u_buddy', title: '你们的这段读伴结束了 · 连接之力' }),
      n({ _id: 'x', type: 'buddy_invite', senderName: '敏慧', senderUserId: 'u_m', data: { inviteId: 'iv9', periodId: 'p1', inviteStatus: 'expired' } })
    ], NOW));
    expect(items[0].sealChar).toBe('伴');
    expect(items[0].rest).toBe('你们的这段读伴结束了，想的话可以再认识一位');
    expect(items[0].avatars).toHaveLength(0);
    expect(items[0].rest).not.toContain('喜娟');
    expect(items[1].invite.status).toBe('expired');
    expect(items[1].needsReply).toBe(false);
  });
  test('有人通过你分享的日签留言：印章字卡片，不带任何对方信息', () => {
    const [item] = flat(buildFeed([n({ type: 'newcomer_shared', senderName: '', title: '你分享的日签，有一位书友想来了' })], NOW));
    expect(item.sealChar).toBe('享');
    expect(item.rest).toBe('你分享的日签，有一位书友想来了，接待书友会和 TA 联系');
    expect(item.avatars).toHaveLength(0);
  });
});
