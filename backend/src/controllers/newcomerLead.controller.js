const mongoose = require('mongoose');
const NewcomerLead = require('../models/NewcomerLead');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const { createNotification } = require('./notification.controller');
const LandingStat = require('../models/LandingStat');
const { getCurrentTenantId } = require('../utils/tenantContext');

// 页面上展示给新书友的授权文案版本。文案改动时同步升级版本号，已留的线索按旧版本留痕。
const CONSENT_VERSION = 'newcomer-consent-v1';
// 对新书友承诺的联系期限（天）
const CONTACT_WITHIN_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

// 接待组成员必须是小程序管理员
const ADMIN_ROLES = ['admin', 'super_admin'];

const MAX_REASON_LENGTH = 60;
const MAX_NOTE_LENGTH = 200;
const PHONE_PATTERN = /^1\d{10}$/;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

// 接待人可以主动推进到的状态；pending 只由系统在创建时设置
const FOLLOW_UP_STATUSES = ['contacted', 'talked', 'connected', 'declined'];

function currentUserId(req) {
  return req.user?.userId || req.user?._id || req.user?.id || null;
}

function toObjectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function maskPhone(phone) {
  const text = String(phone || '').trim();
  if (/^1\d{10}$/.test(text)) return text.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
  return text ? `****${text.slice(-4)}` : '';
}

// 公开展示的分享人信息：只给昵称和头像，不给手机号等其他字段。
function formatPublicUser(user) {
  if (!user) return null;
  return {
    _id: user._id,
    nickname: user.nickname || '书友',
    avatarUrl: user.avatarUrl || '',
    avatar: user.avatar || ''
  };
}

// 新书友自己看到的线索：手机号只给脱敏版，避免被他人在设备上看到全号。
function formatOwnLead(lead) {
  if (!lead) return null;
  return {
    _id: lead._id,
    status: lead.status,
    reason: lead.reason,
    note: lead.note || '',
    phoneMasked: maskPhone(lead.phone),
    contactBy: lead.contactBy,
    createdAt: lead.createdAt
  };
}

async function hasEffectiveEnrollment(userId) {
  if (!userId) return false;
  const enrollment = await Enrollment.findOne({
    userId,
    status: { $in: ['active', 'completed'] },
    paymentStatus: { $in: ['paid', 'free'] },
    deleted: { $ne: true }
  })
    .select('_id')
    .lean();
  return Boolean(enrollment);
}

async function loadPublicInviter(inviterId) {
  const id = toObjectId(inviterId);
  if (!id) return null;
  const user = await User.findById(id).select('nickname avatarUrl avatar status').lean();
  if (!user || user.status !== 'active') return null;
  return formatPublicUser(user);
}

/**
 * 落地页信息（访客可访问，登录与否都行）
 * GET /newcomer-leads/landing?inviterId=
 */
const SOURCE_FROM_QUERY = ['daily_card', 'quote_card', 'keepsake', 'invite'];

function shanghaiDayKey(now = new Date()) {
  return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
}

// 落地页访问计数：只记次数（按天、分享人、来源），失败不影响页面；客户端只在第一次加载时带 view=1，静默刷新不算
async function recordLandingView(req, inviter) {
  try {
    if (req.query.view !== '1') return;
    const inviterObjectId = inviter ? toObjectId(req.query.inviterId) : null;
    const sourceType = SOURCE_FROM_QUERY.includes(req.query.src) ? req.query.src : 'other';
    await LandingStat.updateOne(
      { tenantId: getCurrentTenantId(), dayKey: shanghaiDayKey(), inviterId: inviterObjectId, sourceType },
      { $inc: { views: 1 } },
      { upsert: true }
    );
  } catch (error) {
    logger.warn('落地页访问计数失败', { message: error && error.message });
  }
}

async function getLanding(req, res, next) {
  try {
    const inviter = await loadPublicInviter(req.query.inviterId);
    recordLandingView(req, inviter);
    const userId = currentUserId(req);

    let viewer = { isLoggedIn: false, isMember: false, lead: null };
    if (userId) {
      const [lead, isMember] = await Promise.all([
        NewcomerLead.findOne({ userId }).lean(),
        hasEffectiveEnrollment(userId)
      ]);
      viewer = { isLoggedIn: true, isMember, lead: formatOwnLead(lead) };
    }

    res.json(success({ inviter, viewer, consentVersion: CONSENT_VERSION, contactWithinDays: CONTACT_WITHIN_DAYS }));
  } catch (error) {
    next(error);
  }
}

/**
 * 我的线索（登录用户）
 * GET /newcomer-leads/mine
 */
async function getMyLead(req, res, next) {
  try {
    const userId = currentUserId(req);
    const lead = await NewcomerLead.findOne({ userId }).lean();
    res.json(success({ lead: formatOwnLead(lead) }));
  } catch (error) {
    next(error);
  }
}

function validateSubmission(body = {}) {
  const reason = String(body.reason || '').trim();
  const note = String(body.note || '').trim();
  const phone = String(body.phone || '').trim();

  if (!reason) return { error: '请选一个你想来的原因' };
  if (reason.length > MAX_REASON_LENGTH) return { error: `原因最多 ${MAX_REASON_LENGTH} 个字` };
  if (note.length > MAX_NOTE_LENGTH) return { error: `补充最多 ${MAX_NOTE_LENGTH} 个字` };
  if (!PHONE_PATTERN.test(phone)) return { error: '请输入正确的11位手机号' };
  if (body.agreed !== true) return { error: '需要先同意授权说明' };
  if (body.consentVersion !== CONSENT_VERSION) return { error: '授权说明已更新，请刷新页面后再提交' };

  return { reason, note, phone };
}

// 新书友通过你分享的日签留言了：给分享人一条来信。不写对方是谁，只让分享的人知道有用
async function notifySharer(req, lead, userId) {
  try {
    if (!lead.inviterId || String(lead.inviterId) === String(userId)) return;
    const inviter = await User.findById(lead.inviterId).select('_id status').lean();
    if (!inviter || inviter.status !== 'active') return;
    await createNotification(
      inviter._id,
      'newcomer_shared',
      '你分享的日签，有一位书友想来了',
      '有一位书友通过你分享的日签留言了，接待书友会和 TA 联系。谢谢你把晨读带给身边的人',
      { wsManager: req.wsManager }
    );
  } catch (error) {
    logger.error('通知分享人失败:', error);
  }
}

async function notifyReceptionists(req, lead, userId) {
  try {
    const receptionists = await User.find({
      isNewcomerReceptionist: true,
      status: 'active',
      role: { $in: ADMIN_ROLES },
      _id: { $ne: userId }
    })
      .select('_id')
      .lean();

    await Promise.all(
      receptionists.map(receptionist =>
        createNotification(
          receptionist._id,
          'newcomer_lead',
          '有新书友留言了',
          `想来的原因：${lead.reason}。请在 ${CONTACT_WITHIN_DAYS} 天内联系。`,
          {
            wsManager: req.wsManager,
            senderId: userId,
            data: { targetPage: '/pages/admin-leads/admin-leads', leadId: String(lead._id) }
          }
        )
      )
    );
  } catch (error) {
    // 通知失败不影响新书友提交，接待组仍可在工作台列表里看到
    logger.error('新书友线索通知接待组失败:', error);
  }
}

/**
 * 提交线索（登录用户；访客在页面上静默登录后调用）
 * POST /newcomer-leads
 * 同一用户只有一条线索：待联系时可以更新原因和手机号，已被接待人跟进后不再覆盖。
 */
async function submitLead(req, res, next) {
  try {
    const userId = currentUserId(req);
    const checked = validateSubmission(req.body);
    if (checked.error) {
      return res.status(400).json(errors.badRequest(checked.error));
    }

    if (await hasEffectiveEnrollment(userId)) {
      return res.status(409).json(errors.conflict('你已经在营里了'));
    }

    const existing = await NewcomerLead.findOne({ userId });
    if (existing && existing.status !== 'pending') {
      return res.status(409).json(errors.conflict('接待书友已经在跟进你的留言了'));
    }
    if (existing && existing.assigneeId) {
      // 已被认领但还没联系：只允许改手机号，避免接待人看到的信息在聊之前被改动
      existing.phone = checked.phone;
      await existing.save();
      return res.json(success({ lead: formatOwnLead(existing) }, '已更新'));
    }

    const inviterObjectId = toObjectId(req.body.inviterId);
    const inviterId =
      inviterObjectId && String(inviterObjectId) !== String(userId) ? inviterObjectId : null;
    const sourceType = NewcomerLead.SOURCE_TYPES.includes(req.body.sourceType)
      ? req.body.sourceType
      : 'other';

    if (existing) {
      existing.reason = checked.reason;
      existing.note = checked.note;
      existing.phone = checked.phone;
      existing.consentVersion = CONSENT_VERSION;
      existing.consentAt = new Date();
      await existing.save();
      return res.json(success({ lead: formatOwnLead(existing) }, '已更新'));
    }

    const now = new Date();
    const lead = await NewcomerLead.create({
      userId,
      inviterId,
      sourceType,
      reason: checked.reason,
      note: checked.note,
      phone: checked.phone,
      consentVersion: CONSENT_VERSION,
      consentAt: now,
      contactBy: new Date(now.getTime() + CONTACT_WITHIN_DAYS * DAY_MS)
    });

    await notifyReceptionists(req, lead, userId);
    await notifySharer(req, lead, userId);
    res.status(201).json(success({ lead: formatOwnLead(lead) }, '收到了'));
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json(errors.conflict('你已经留过言了'));
    }
    next(error);
  }
}

/**
 * 分享人的专属小程序码：扫码进入落地页，scene 里带分享人 id。
 * scene 最长 32 个字符：`i=` + 24 位 id + `&s=d` 共 30 个。
 * POST /newcomer-leads/qrcode  { source }
 */
const QR_SOURCE_CODES = { daily_card: 'd', quote_card: 'q', keepsake: 'k', invite: 'v' };
const QR_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const QR_CACHE_MAX = 500;
const qrCache = new Map();

// 小程序码默认指向正式版，页面还没发布时会生成失败；客户端把当前版本带上，体验版、开发版也能生成
const QR_ENV_VERSIONS = { develop: 'develop', trial: 'trial', release: 'release' };

async function requestWxacode(scene, envVersion = 'release') {
  const axios = require('axios');
  const subscribeMessageService = require('../services/subscribe-message.service');
  const accessToken = await subscribeMessageService.getAccessToken();
  const response = await axios.post(
    `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${accessToken}`,
    { scene, page: 'pages/landing/landing', check_path: false, env_version: envVersion, width: 280 },
    { responseType: 'arraybuffer', timeout: 8000 }
  );
  const contentType = String(response.headers?.['content-type'] || '');
  if (!contentType.startsWith('image/')) {
    // 失败时微信返回 JSON 错误体
    let detail = '';
    try {
      detail = Buffer.from(response.data).toString('utf8').slice(0, 200);
    } catch (e) {
      detail = '';
    }
    throw new Error(`getwxacodeunlimit 失败: ${detail}`);
  }
  return Buffer.from(response.data).toString('base64');
}

async function createInviteQrcode(req, res, next) {
  try {
    const userId = String(currentUserId(req) || '');
    if (!toObjectId(userId)) return res.status(401).json(errors.unauthorized('未登录'));

    const sourceCode = QR_SOURCE_CODES[req.body?.source] || 'd';
    const scene = `i=${userId}&s=${sourceCode}`;

    const envVersion = QR_ENV_VERSIONS[req.body?.envVersion] || 'release';
    const cacheKey = `${req.user?.tenantId || ''}:${envVersion}:${scene}`;
    const cached = qrCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json(success({ imageBase64: cached.imageBase64, contentType: 'image/png' }));
    }

    let imageBase64;
    try {
      imageBase64 = await requestWxacode(scene, envVersion);
    } catch (error) {
      // 生成失败时前端回退到通用码，海报照常可用
      logger.error('生成分享小程序码失败:', error);
      return res.status(503).json(errors.serviceUnavailable('小程序码暂时生成不了'));
    }

    if (qrCache.size >= QR_CACHE_MAX) qrCache.delete(qrCache.keys().next().value);
    qrCache.set(cacheKey, { imageBase64, expiresAt: Date.now() + QR_CACHE_TTL_MS });
    res.json(success({ imageBase64, contentType: 'image/png' }));
  } catch (error) {
    next(error);
  }
}

// ---------- 接待组（移动端管理员） ----------

/**
 * 落地页数据：最近 N 天的访问次数、留言数、转化率，以及带来留言最多的分享人
 * GET /mobile-admin/newcomer-leads/stats?days=30
 */
async function getStats(req, res, next) {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 90);
    const since = new Date(Date.now() - days * DAY_MS);
    const sinceKey = shanghaiDayKey(since);
    const [viewRows, leads] = await Promise.all([
      LandingStat.find({ dayKey: { $gte: sinceKey } }).select('views inviterId').lean(),
      NewcomerLead.find({ createdAt: { $gte: since } }).select('inviterId').lean()
    ]);
    const views = viewRows.reduce((sum, row) => sum + (row.views || 0), 0);
    const byInviter = {};
    leads.forEach(lead => {
      if (lead.inviterId) byInviter[String(lead.inviterId)] = (byInviter[String(lead.inviterId)] || 0) + 1;
    });
    const topIds = Object.keys(byInviter)
      .sort((a, b) => byInviter[b] - byInviter[a])
      .slice(0, 5);
    const users = topIds.length ? await User.find({ _id: { $in: topIds } }).select('nickname').lean() : [];
    const names = users.reduce((all, user) => ({ ...all, [String(user._id)]: user.nickname || '书友' }), {});
    res.json(
      success({
        days,
        views,
        leads: leads.length,
        fromShares: leads.filter(lead => lead.inviterId).length,
        conversion: views > 0 ? Math.round((leads.length / views) * 1000) / 10 : null,
        topInviters: topIds.map(id => ({ nickname: names[id] || '书友', leads: byInviter[id] }))
      })
    );
  } catch (error) {
    next(error);
  }
}


function parsePagination(query = {}) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const pageSize = Math.min(
    Math.max(Number.parseInt(query.pageSize, 10) || DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  );
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function formatLeadListItem(lead, usersById) {
  const user = usersById.get(String(lead.userId));
  const inviter = lead.inviterId ? usersById.get(String(lead.inviterId)) : null;
  const assignee = lead.assigneeId ? usersById.get(String(lead.assigneeId)) : null;
  const dueSoon =
    lead.status === 'pending' && lead.contactBy
      ? new Date(lead.contactBy).getTime() - Date.now() < DAY_MS
      : false;
  return {
    _id: lead._id,
    status: lead.status,
    reason: lead.reason,
    note: lead.note || '',
    sourceType: lead.sourceType,
    nickname: user?.nickname || '微信用户',
    avatarUrl: user?.avatarUrl || '',
    avatar: user?.avatar || '',
    inviterName: inviter?.nickname || '',
    assigneeId: lead.assigneeId || null,
    assigneeName: assignee?.nickname || '',
    contactBy: lead.contactBy,
    dueSoon,
    createdAt: lead.createdAt
  };
}

async function loadUsersById(userIds) {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  if (ids.length === 0) return new Map();
  const users = await User.find({ _id: { $in: ids } })
    .select('nickname avatarUrl avatar')
    .lean();
  return new Map(users.map(user => [String(user._id), user]));
}

/**
 * 线索列表
 * GET /mobile-admin/newcomer-leads?status=&scope=mine|all&page=
 */
async function listLeads(req, res, next) {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const query = {};
    if (NewcomerLead.LEAD_STATUSES.includes(req.query.status)) {
      query.status = req.query.status;
    }
    if (req.query.scope === 'mine') {
      query.assigneeId = req.mobileAdmin._id;
    }

    const [items, total, grouped] = await Promise.all([
      NewcomerLead.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
      NewcomerLead.countDocuments(query),
      NewcomerLead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    ]);

    const usersById = await loadUsersById(
      items.flatMap(lead => [lead.userId, lead.inviterId, lead.assigneeId])
    );
    const counts = { pending: 0, contacted: 0, talked: 0, connected: 0, declined: 0 };
    grouped.forEach(row => {
      if (row._id in counts) counts[row._id] = row.count;
    });

    const totalPages = Math.ceil(total / pageSize);
    res.json(
      success({
        items: items.map(lead => formatLeadListItem(lead, usersById)),
        counts,
        pagination: { page, pageSize, total, totalPages, hasMore: page < totalPages }
      })
    );
  } catch (error) {
    next(error);
  }
}

/**
 * 线索详情。完整手机号只给已认领的接待人本人，其他管理员只看脱敏号。
 * GET /mobile-admin/newcomer-leads/:leadId
 */
async function getLeadDetail(req, res, next) {
  try {
    const leadId = toObjectId(req.params.leadId);
    if (!leadId) return res.status(400).json(errors.badRequest('线索ID无效'));

    const lead = await NewcomerLead.findById(leadId).lean();
    if (!lead) return res.status(404).json(errors.notFound('线索不存在'));

    const usersById = await loadUsersById([
      lead.userId,
      lead.inviterId,
      lead.assigneeId,
      ...(lead.followUps || []).map(item => item.byUserId)
    ]);
    const isAssignee = lead.assigneeId && String(lead.assigneeId) === String(req.mobileAdmin._id);

    res.json(
      success({
        lead: {
          ...formatLeadListItem(lead, usersById),
          phone: isAssignee ? lead.phone : '',
          phoneMasked: maskPhone(lead.phone),
          isAssignee: Boolean(isAssignee),
          claimedAt: lead.claimedAt,
          followUps: (lead.followUps || []).map(item => ({
            status: item.status,
            note: item.note || '',
            at: item.at,
            byName: usersById.get(String(item.byUserId))?.nickname || ''
          }))
        }
      })
    );
  } catch (error) {
    next(error);
  }
}

/**
 * 认领。原子操作：只有还没人认领的线索能被认领，两个人同时点只有一个成功。
 * POST /mobile-admin/newcomer-leads/:leadId/claim
 */
async function claimLead(req, res, next) {
  try {
    const leadId = toObjectId(req.params.leadId);
    if (!leadId) return res.status(400).json(errors.badRequest('线索ID无效'));

    const lead = await NewcomerLead.findOneAndUpdate(
      { _id: leadId, assigneeId: null },
      { $set: { assigneeId: req.mobileAdmin._id, claimedAt: new Date() } },
      { new: true }
    ).lean();

    if (!lead) {
      const exists = await NewcomerLead.exists({ _id: leadId });
      if (!exists) return res.status(404).json(errors.notFound('线索不存在'));
      return res.status(409).json(errors.conflict('这条已经有人认领了'));
    }

    res.json(success({ leadId: lead._id }, '已认领'));
  } catch (error) {
    next(error);
  }
}

/**
 * 推进跟进状态，只有认领人可以操作。
 * PATCH /mobile-admin/newcomer-leads/:leadId  { status, note }
 */
async function updateLeadStatus(req, res, next) {
  try {
    const leadId = toObjectId(req.params.leadId);
    if (!leadId) return res.status(400).json(errors.badRequest('线索ID无效'));

    const status = req.body?.status;
    const note = String(req.body?.note || '').trim();
    if (!FOLLOW_UP_STATUSES.includes(status)) {
      return res.status(400).json(errors.badRequest('状态不正确'));
    }
    if (note.length > MAX_NOTE_LENGTH) {
      return res.status(400).json(errors.badRequest(`备注最多 ${MAX_NOTE_LENGTH} 个字`));
    }

    const lead = await NewcomerLead.findOneAndUpdate(
      { _id: leadId, assigneeId: req.mobileAdmin._id },
      {
        $set: { status },
        $push: { followUps: { byUserId: req.mobileAdmin._id, status, note, at: new Date() } }
      },
      { new: true }
    ).lean();

    if (!lead) {
      const exists = await NewcomerLead.exists({ _id: leadId });
      if (!exists) return res.status(404).json(errors.notFound('线索不存在'));
      return res.status(403).json(errors.forbidden('请先认领这条线索'));
    }

    res.json(success({ leadId: lead._id, status: lead.status }, '已更新'));
  } catch (error) {
    next(error);
  }
}

/**
 * 接待组身份由后台“用户管理”配置，小程序里不能自行开关。
 * 接待组成员必须是小程序管理员；接待组之外的管理员看不到线索和完整手机号。
 */
function isActiveReceptionist(user) {
  return Boolean(
    user && user.status === 'active' && ADMIN_ROLES.includes(user.role) && user.isNewcomerReceptionist
  );
}

async function requireReceptionist(req, res, next) {
  try {
    const userId = toObjectId(currentUserId(req));
    if (!userId) return res.status(401).json(errors.unauthorized('未登录'));

    const user = await User.findById(userId)
      .select('role status nickname isNewcomerReceptionist')
      .lean();
    if (!isActiveReceptionist(user)) {
      return res.status(403).json(errors.forbidden('需要接待组权限'));
    }

    req.mobileAdmin = user;
    return next();
  } catch (error) {
    logger.error('接待组鉴权失败:', error);
    return res.status(500).json(errors.serverError('接待组鉴权失败'));
  }
}

/**
 * 当前登录人是否在接待组（用于决定是否显示入口）
 * GET /mobile-admin/newcomer-leads/access
 */
async function getAccess(req, res, next) {
  try {
    const userId = toObjectId(currentUserId(req));
    const user = userId
      ? await User.findById(userId).select('role status isNewcomerReceptionist').lean()
      : null;
    res.json(success({ isReceptionist: isActiveReceptionist(user) }));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  CONSENT_VERSION,
  CONTACT_WITHIN_DAYS,
  getLanding,
  getMyLead,
  submitLead,
  createInviteQrcode,
  getStats,
  listLeads,
  getLeadDetail,
  claimLead,
  updateLeadStatus,
  requireReceptionist,
  getAccess
};
