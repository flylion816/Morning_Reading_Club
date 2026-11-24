const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

const userId = '507f1f77bcf86cd799439011';
const noteId = '507f1f77bcf86cd799439012';

describe('Companion note controller', () => {
  let sandbox;
  let controller;
  let req;
  let res;
  let next;
  let loadAccessibleNote;
  let CompanionNoteRead;
  let CompanionNoteComment;
  let contentSecurity;
  let dispatchNotificationWithSubscribe;
  let User;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    req = {
      params: { id: noteId },
      body: { content: '这份陪伴让我慢了下来' },
      query: {},
      user: { userId }
    };
    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };
    next = sandbox.stub();
    loadAccessibleNote = sandbox.stub().resolves({
      _id: noteId,
      title: '手札',
      companionUserId: null,
      status: 'published',
      periodId: null
    });
    CompanionNoteRead = {
      findOneAndUpdate: sandbox.stub()
    };
    CompanionNoteComment = {
      create: sandbox.stub().resolves({
        _id: '507f1f77bcf86cd799439013',
        noteId,
        userId,
        content: req.body.content,
        replies: [],
        likes: [],
        toObject() {
          return this;
        }
      }),
      countDocuments: sandbox.stub().resolves(1),
      findOne: sandbox.stub(),
      updateOne: sandbox.stub().resolves()
    };
    User = {
      findById: sandbox.stub().returns({
        select: sandbox.stub().returns({
          lean: sandbox.stub().resolves({
            _id: userId,
            openid: 'openid-test',
            nickname: '书友'
          })
        })
      })
    };
    contentSecurity = {
      checkText: sandbox.stub().resolves(),
      CONTENT_RISKY: 'CONTENT_RISKY',
      CONTENT_CHECK_UNAVAILABLE: 'CONTENT_CHECK_UNAVAILABLE',
      SCENE_COMMENT: 2
    };
    dispatchNotificationWithSubscribe = sandbox.stub().resolves();

    controller = proxyquire('../../../src/controllers/companion-note.controller', {
      '../models/CompanionNote': {
        updateOne: sandbox.stub().resolves(),
        findById: sandbox.stub().resolves({ likeCount: 0 })
      },
      '../models/CompanionNoteComment': CompanionNoteComment,
      '../models/CompanionNoteLike': {},
      '../models/CompanionNoteRead': CompanionNoteRead,
      '../models/Period': {},
      '../models/Section': {},
      '../models/User': User,
      '../utils/tenantContext': { getCurrentTenantId: () => '507f1f77bcf86cd799439014' },
      '../utils/logger': { warn: sandbox.stub(), error: sandbox.stub() },
      '../services/content-security.service': contentSecurity,
      '../services/user-notification.service': { dispatchNotificationWithSubscribe },
      '../services/community-access.service': { getCommunityAccessiblePeriodIds: sandbox.stub().resolves([]) },
      '../services/period-access.service': {},
      '../services/companion-note-access.service': {
        PUBLISHED_NOTE_FILTER: { status: 'published', deletedAt: null },
        idString: value => String(value),
        isValidObjectId: () => true,
        hasPeriodCommunityAccess: sandbox.stub().resolves(true),
        loadAccessibleNote,
        buildAccessibleNoteFilter: sandbox.stub(),
        getPublishedSections: sandbox.stub().resolves([]),
        sectionLabelsForNote: sandbox.stub().returns([]),
        toPublicNote: (note, extra) => ({ ...note, ...extra })
      },
      '../services/companion-note-files.service': {
        storeUpload: sandbox.stub(),
        storePage: sandbox.stub(),
        inspectUpload: sandbox.stub(),
        removeUploadDirectory: sandbox.stub(),
        resolvePdfPath: sandbox.stub(),
        encodeTicket: sandbox.stub(),
        decodeTicket: sandbox.stub(),
        cleanupOrphanUploads: sandbox.stub().resolves(),
        isSafeFileToken: () => true
      },
      '../utils/notification-links': {
        buildCompanionNoteTargetPage: () => 'pages/companion-notes/detail/detail?id=note',
        formatNotificationTime: () => '2026-11-17 12:00',
        truncateText: value => value
      }
    });
  });

  afterEach(() => sandbox.restore());

  it('内容安全拦截时不保存也不通知，并返回可识别的400错误', async () => {
    const error = new Error('risky');
    error.code = contentSecurity.CONTENT_RISKY;
    contentSecurity.checkText.rejects(error);

    await controller.createComment(req, res, next);

    expect(next.calledOnce).to.equal(true);
    expect(next.firstCall.args[0].statusCode).to.equal(400);
    expect(CompanionNoteComment.create.called).to.equal(false);
    expect(dispatchNotificationWithSubscribe.called).to.equal(false);
  });

  it('内容安全服务不可用时返回503并保留输入给调用方', async () => {
    const error = new Error('timeout');
    error.code = contentSecurity.CONTENT_CHECK_UNAVAILABLE;
    contentSecurity.checkText.rejects(error);

    await controller.createComment(req, res, next);

    expect(next.calledOnce).to.equal(true);
    expect(next.firstCall.args[0].statusCode).to.equal(503);
    expect(CompanionNoteComment.create.called).to.equal(false);
  });

  it('草稿或无权限手札按不存在处理', async () => {
    loadAccessibleNote.resolves(null);

    await controller.createComment(req, res, next);

    expect(res.status.calledWith(404)).to.equal(true);
    expect(CompanionNoteComment.create.called).to.equal(false);
  });

  it('手札打开计数使用聚合更新，避免 openCount 更新路径冲突', async () => {
    CompanionNoteRead.findOneAndUpdate
      .onFirstCall().rejects(Object.assign(new Error('duplicate'), { code: 11000 }))
      .onSecondCall().resolves({ openCount: 3 });

    await controller.markRead(req, res, next);

    expect(CompanionNoteRead.findOneAndUpdate.calledTwice).to.equal(true);
    expect(CompanionNoteRead.findOneAndUpdate.firstCall.args[1]).to.be.an('array');
    expect(CompanionNoteRead.findOneAndUpdate.secondCall.args[1]).to.be.an('array');
    expect(res.json.calledWithMatch({ data: { firstRead: false } })).to.equal(true);
  });
});
