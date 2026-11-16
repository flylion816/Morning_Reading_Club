const { expect } = require('chai');
const Notification = require('../../../src/models/Notification');

// Notification.data 是固定字段清单：不在清单里的字段保存时会被静默丢掉。
// 来信页依赖下面这些字段，新增依赖时要同步加进模型。
describe('Notification.data 字段清单', () => {
  const required = [
    'senderName', 'senderAvatar', 'periodId', 'sectionId', 'checkinId', 'commentId', 'targetPage',
    'fromBuddy', 'sectionTitle', 'commentPreview', 'inviteId', 'joyNoteId', 'insightLabel'
  ];

  it('来信页用到的字段都在清单里', () => {
    required.forEach(key => {
      expect(Notification.schema.path(`data.${key}`), key).to.exist;
    });
  });

  it('读伴相关的通知类型都已登记', () => {
    const types = Notification.schema.path('type').enumValues;
    ['buddy_nudge', 'buddy_highfive', 'buddy_gift', 'buddy_checkin', 'buddy_reaction', 'buddy_invite', 'buddy_invite_accepted', 'buddy_ended', 'newcomer_shared', 'awareness_revisit']
      .forEach(type => expect(types, type).to.include(type));
  });
});
