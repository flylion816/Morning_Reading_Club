const express = require('express');
const wechatController = require('../controllers/wechat.controller');

const router = express.Router();

router.get('/jssdk-signature', wechatController.getJssdkSignature);
router.get('/jssdk-report', wechatController.reportJssdkEvent);

module.exports = router;
