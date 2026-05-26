const express = require('express');
const ctrl = require('../controllers/activityCoupon.controller');
const { authMiddleware } = require('../middleware/auth');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const { userTenantContext, adminTenantContext } = require('../middleware/tenantContext');

const adminRouter = express.Router();
adminRouter.use(adminAuthMiddleware, adminTenantContext);
adminRouter.get('/', ctrl.adminList);
adminRouter.post('/', ctrl.adminCreate);
adminRouter.put('/:id', ctrl.adminUpdate);
adminRouter.delete('/:id', ctrl.adminDelete);

const userRouter = express.Router();
userRouter.get('/my', authMiddleware, userTenantContext, ctrl.getMyCoupons);

module.exports = { adminRouter, userRouter };
