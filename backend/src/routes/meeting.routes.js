const express = require('express');
const { openMeetingLaunchPage } = require('../controllers/meeting.controller');

const router = express.Router();

router.get('/meeting-launch', openMeetingLaunchPage);

module.exports = router;
