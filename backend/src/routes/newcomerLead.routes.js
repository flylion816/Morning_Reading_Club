const express = require('express');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const {
  userTenantContext,
  optionalUserOrPublicTenantContext
} = require('../middleware/tenantContext');
const controller = require('../controllers/newcomerLead.controller');

// 新书友侧：落地页信息可匿名访问，提交与查询自己的线索需要登录
const visitorRouter = express.Router();

visitorRouter.get(
  '/landing',
  optionalAuthMiddleware,
  optionalUserOrPublicTenantContext,
  controller.getLanding
);
visitorRouter.get('/mine', authMiddleware, userTenantContext, controller.getMyLead);
visitorRouter.post('/', authMiddleware, userTenantContext, controller.submitLead);
visitorRouter.post('/qrcode', authMiddleware, userTenantContext, controller.createInviteQrcode);

// 接待组侧：身份由后台用户管理配置
const receptionRouter = express.Router();

receptionRouter.use(authMiddleware);
receptionRouter.use(userTenantContext);

// 任何登录用户都可以问“我是不是接待组”，其余接口都要求接待组身份
receptionRouter.get('/access', controller.getAccess);
receptionRouter.use(controller.requireReceptionist);

receptionRouter.get('/stats', controller.getStats);
receptionRouter.get('/', controller.listLeads);
receptionRouter.get('/:leadId', controller.getLeadDetail);
receptionRouter.post('/:leadId/claim', controller.claimLead);
receptionRouter.patch('/:leadId', controller.updateLeadStatus);

module.exports = { visitorRouter, receptionRouter };
