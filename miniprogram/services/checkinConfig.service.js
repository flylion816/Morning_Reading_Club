const request = require('../utils/request');

const getConfig = () => request.get('/checkin-celebration-config');

module.exports = { getConfig };
