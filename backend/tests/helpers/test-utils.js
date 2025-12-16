/**
 * 测试工具函数
 */

const sinon = require('sinon');

/**
 * 创建模拟的 Express 请求和响应对象
 */
function createMocks() {
  const req = {
    body: {},
    params: {},
    query: {},
    user: {},
    headers: {},
    get: sinon.stub()
  };

  const res = {
    status: sinon.stub().returnsThis(),
    json: sinon.stub().returnsThis(),
    send: sinon.stub().returnsThis(),
    setHeader: sinon.stub().returnsThis(),
    statusCode: 200,
    _getStatusCode: sinon.stub().returns(200)
  };

  const next = sinon.stub();

  return { req, res, next };
}

/**
 * 验证响应状态码和格式
 */
function verifyResponse(res, expectedStatus, expectData = true) {
  if (expectedStatus) {
    res.status.calledWith(expectedStatus);
  }

  const jsonCall = res.json.getCall(0);
  if (expectData && jsonCall) {
    const responseBody = jsonCall.args[0];
    return responseBody;
  }

  return null;
}

/**
 * 创建用户认证信息
 */
function createAuthUser(userId, role = 'user') {
  return {
    userId,
    id: userId,
    role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  };
}

/**
 * 延迟执行（用于异步测试）
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  createMocks,
  verifyResponse,
  createAuthUser,
  delay
};
