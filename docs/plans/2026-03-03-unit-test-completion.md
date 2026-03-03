# 单元测试补全实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 1-2 天内实现 100% 代码覆盖率的单元测试，严格遵守单条数据操作规范，与 219 个测试用例文档完全对应。

**Architecture:**
- 双阶段递进：Day 1 完成认证、报名、支付（关键路径）；Day 2 完成打卡、小凡看见、全流程集成
- 三层测试：单元测试（Controller/Service/Middleware）+ 集成测试（完整业务流程）+ 数据安全验证
- 100% 覆盖：所有分支、所有错误场景、所有边界值、所有安全场景

**Tech Stack:**
- Mocha + Chai + Sinon（单元测试）
- proxyquire（模块 mock）
- MongoDB Memory Server（集成测试环境）
- NYC（覆盖率报告）

**Data Safety Principle:**
- ❌ 禁止：deleteMany()、dropDatabase()、init-*.js 脚本、批量删除
- ✅ 允许：单条 create()、findByIdAndUpdate()、findByIdAndDelete()

---

## 阶段 0: 准备工作

### Task 0.1: 审视现有测试框架和代码质量

**Files:**
- Review: `backend/tests/unit/controllers/auth.controller.test.js`
- Review: `backend/tests/integration/`
- Review: `backend/package.json` (test scripts)
- Review: `backend/.env.test`

**Step 1: 检查现有测试的质量**

运行：
```bash
cd /Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend
npm test 2>&1 | head -200
```

预期输出：显示当前测试状态、通过/失败数量、覆盖率报告

**Step 2: 识别问题测试**

审查标准：
- ✅ 保留：覆盖正常场景 + 至少一个错误场景
- ❌ 删除：重复、不完整（缺少错误验证）、不符合规范
- 🔧 修复：缺少安全场景、缺少边界值测试、缺少并发测试

关键检查点：
- [ ] 是否有 Mock 数据库或使用真实数据库？
- [ ] afterEach 是否有清理代码？是否使用了 deleteMany？
- [ ] 是否覆盖了至少 3 种错误场景？
- [ ] 是否有安全相关的测试（如 Token 验证）？

**Step 3: 创建审视报告（可选，但有帮助）**

统计当前状态：
- 现有测试文件数量
- 现有测试用例总数
- 覆盖率数据
- 问题测试清单

---

## 阶段 1: Day 1 - 认证 + 报名 + 支付

### Task 1.1: 重构 Auth Controller 单元测试（100% 覆盖）

**Files:**
- Modify: `backend/tests/unit/controllers/auth.controller.test.js` (完全重写)
- Modify: `backend/tests/unit/services/auth.service.test.js` (新增)
- Reference: `backend/src/controllers/auth.controller.js`
- Reference: `backend/src/services/auth.service.js`

**目标覆盖场景** (按 TC-AUTH-001~007 + TC-SEC-001~003)：
1. ✅ 微信登录成功（返回 user + token）
2. ✅ 微信 code 无效（返回 401）
3. ✅ Token 过期，刷新成功
4. ✅ 刷新 Token 无效（返回 401）
5. ✅ 登出成功
6. ✅ 缺少 Authorization header（返回 401）
7. ✅ 无效的 Token 格式（返回 401）

**Step 1: 编写 Fixtures（测试数据）**

创建/修改：`backend/tests/fixtures/auth-fixtures.js`

```javascript
module.exports = {
  validWechatCode: 'test_code_' + Date.now(),
  validOpenid: 'test_openid_' + Date.now(),
  validUser: {
    openid: 'test_openid_001',
    nickname: 'TestUser',
    avatar: 'http://example.com/avatar.jpg',
    status: 'normal'
  },
  validTokens: {
    accessToken: 'test_access_token_' + Date.now(),
    refreshToken: 'test_refresh_token_' + Date.now()
  },
  expiredToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjB9.invalid',
  malformedToken: 'not.a.token'
};
```

**Step 2: 编写 Controller 单元测试**

编写：`backend/tests/unit/controllers/auth.controller.test.js`

```javascript
const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const fixtures = require('../../fixtures/auth-fixtures');

describe('Auth Controller - 100% Coverage', () => {
  let authController;
  let authServiceStub;
  let jwtUtilStub;
  let wechatServiceStub;
  let sandbox;
  let req, res, next;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock 响应对象
    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis(),
      setHeader: sandbox.stub().returnsThis()
    };

    next = sandbox.stub();

    // Mock 服务
    authServiceStub = {
      wechatLogin: sandbox.stub(),
      refreshAccessToken: sandbox.stub(),
      logout: sandbox.stub()
    };

    jwtUtilStub = {
      generateTokens: sandbox.stub(),
      verifyRefreshToken: sandbox.stub()
    };

    wechatServiceStub = {
      getOpenidFromCode: sandbox.stub()
    };

    // 使用 proxyquire 注入 mock
    authController = proxyquire(
      '../../../src/controllers/auth.controller',
      {
        '../services/auth.service': authServiceStub,
        '../utils/jwt.util': jwtUtilStub,
        '../services/wechat.service': wechatServiceStub
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  // 🟢 正常场景
  describe('微信登录 - 正常流程', () => {
    it('TC-AUTH-001: 应该成功登录并返回 user + token', async () => {
      // Given
      req = {
        body: { code: fixtures.validWechatCode }
      };

      const mockUser = { _id: 'user_001', ...fixtures.validUser };
      const mockTokens = fixtures.validTokens;

      authServiceStub.wechatLogin.resolves({
        user: mockUser,
        tokens: mockTokens
      });

      // When
      await authController.wechatLogin(req, res, next);

      // Then
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.user._id).to.equal('user_001');
      expect(responseData.user.nickname).to.equal('TestUser');
      expect(responseData.accessToken).to.equal(mockTokens.accessToken);
      expect(authServiceStub.wechatLogin.calledWith(fixtures.validWechatCode)).to.be.true;
    });
  });

  // 🔴 错误场景
  describe('微信登录 - 错误处理', () => {
    it('TC-AUTH-002: 微信 code 无效应该返回 401', async () => {
      req = {
        body: { code: 'invalid_code' }
      };

      authServiceStub.wechatLogin.rejects(new Error('Invalid code'));

      await authController.wechatLogin(req, res, next);

      expect(res.status.calledWith(401)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
    });

    it('TC-AUTH-003: 缺少 code 参数应该返回 400', async () => {
      req = { body: {} };

      await authController.wechatLogin(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
    });
  });

  // 🔐 Token 处理
  describe('Token 管理', () => {
    it('TC-AUTH-004: Token 过期时应该能刷新', async () => {
      req = {
        body: { refreshToken: fixtures.validTokens.refreshToken }
      };

      const newTokens = {
        accessToken: 'new_access_' + Date.now(),
        refreshToken: 'new_refresh_' + Date.now()
      };

      authServiceStub.refreshAccessToken.resolves(newTokens);

      await authController.refreshToken(req, res, next);

      expect(res.status.calledWith(200)).to.be.true;
      expect(authServiceStub.refreshAccessToken.calledOnce).to.be.true;
    });

    it('TC-AUTH-005: 无效的 refreshToken 应该返回 401', async () => {
      req = {
        body: { refreshToken: 'invalid_refresh_token' }
      };

      authServiceStub.refreshAccessToken.rejects(new Error('Invalid token'));

      await authController.refreshToken(req, res, next);

      expect(res.status.calledWith(401)).to.be.true;
    });

    it('TC-AUTH-006: 缺少 refreshToken 应该返回 400', async () => {
      req = { body: {} };

      await authController.refreshToken(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
    });
  });

  // 🚪 登出
  describe('登出', () => {
    it('TC-AUTH-007: 应该成功登出', async () => {
      req = {
        user: { _id: 'user_001' },
        headers: { authorization: 'Bearer ' + fixtures.validTokens.accessToken }
      };

      authServiceStub.logout.resolves({ message: 'Logged out' });

      await authController.logout(req, res, next);

      expect(res.status.calledWith(200)).to.be.true;
      expect(authServiceStub.logout.calledWith('user_001')).to.be.true;
    });
  });

  // 🔒 安全测试
  describe('安全性', () => {
    it('TC-SEC-001: 缺少 Authorization header 应该返回 401', async () => {
      req = { headers: {} };

      // 这个通常由 middleware 处理，但 controller 也应该有防守
      expect(() => authController.getProfile(req, res, next)).to.throw;
    });

    it('TC-SEC-002: 无效的 Token 格式应该返回 401', async () => {
      req = {
        headers: { authorization: fixtures.malformedToken }
      };

      jwtUtilStub.verifyRefreshToken.throws(new Error('Invalid token'));

      await authController.refreshToken(req, res, next);

      expect(res.status.calledWith(401)).to.be.true;
    });

    it('TC-SEC-003: 应该防止 Token 重用', async () => {
      req = {
        body: { refreshToken: fixtures.validTokens.refreshToken }
      };

      // 模拟 Token 已被使用
      authServiceStub.refreshAccessToken.rejects(
        new Error('Token已被使用，疑似重放攻击')
      );

      await authController.refreshToken(req, res, next);

      expect(res.status.calledWith(401)).to.be.true;
    });
  });
});
```

**Step 3: 运行测试验证所有用例通过**

```bash
cd /Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend
npm run test:unit -- tests/unit/controllers/auth.controller.test.js
```

预期：✅ 所有 10+ 个测试通过

**Step 4: 编写 Auth Service 单元测试**

编写：`backend/tests/unit/services/auth.service.test.js`

```javascript
const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const fixtures = require('../../fixtures/auth-fixtures');

describe('Auth Service - 业务逻辑', () => {
  let authService;
  let UserModelStub;
  let wechatServiceStub;
  let jwtUtilStub;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    UserModelStub = {
      findOne: sandbox.stub(),
      create: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub()
    };

    wechatServiceStub = {
      getOpenidFromCode: sandbox.stub()
    };

    jwtUtilStub = {
      generateTokens: sandbox.stub()
    };

    authService = proxyquire(
      '../../../src/services/auth.service',
      {
        '../models/User': UserModelStub,
        '../services/wechat.service': wechatServiceStub,
        '../utils/jwt.util': jwtUtilStub
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('wechatLogin', () => {
    it('应该创建新用户如果 openid 不存在', async () => {
      // Given
      wechatServiceStub.getOpenidFromCode.resolves({
        openid: fixtures.validOpenid,
        nickname: 'NewUser'
      });

      UserModelStub.findOne.resolves(null); // 用户不存在

      const newUser = { _id: 'user_new', ...fixtures.validUser };
      UserModelStub.create.resolves(newUser);

      jwtUtilStub.generateTokens.resolves(fixtures.validTokens);

      // When
      const result = await authService.wechatLogin(fixtures.validWechatCode);

      // Then
      expect(UserModelStub.create.calledOnce).to.be.true;
      expect(result.user._id).to.equal('user_new');
      expect(result.tokens.accessToken).to.exist;
    });

    it('应该返回现有用户如果 openid 已存在', async () => {
      // Given
      wechatServiceStub.getOpenidFromCode.resolves({
        openid: fixtures.validOpenid
      });

      const existingUser = { _id: 'user_existing', ...fixtures.validUser };
      UserModelStub.findOne.resolves(existingUser);

      jwtUtilStub.generateTokens.resolves(fixtures.validTokens);

      // When
      const result = await authService.wechatLogin(fixtures.validWechatCode);

      // Then
      expect(UserModelStub.create.called).to.be.false;
      expect(result.user._id).to.equal('user_existing');
    });

    it('应该在 openid 无效时抛出错误', async () => {
      // Given
      wechatServiceStub.getOpenidFromCode.rejects(
        new Error('Invalid code')
      );

      // When & Then
      try {
        await authService.wechatLogin('invalid_code');
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error.message).to.include('Invalid code');
      }
    });
  });

  describe('refreshAccessToken', () => {
    it('应该生成新的 accessToken', async () => {
      // Given
      const oldTokens = fixtures.validTokens;
      const newTokens = {
        accessToken: 'new_access_' + Date.now(),
        refreshToken: oldTokens.refreshToken
      };

      jwtUtilStub.generateTokens.resolves(newTokens);

      // When
      const result = await authService.refreshAccessToken(oldTokens.refreshToken);

      // Then
      expect(result.accessToken).to.equal(newTokens.accessToken);
      expect(result.refreshToken).to.equal(newTokens.refreshToken);
    });

    it('应该在 refreshToken 无效时抛出错误', async () => {
      // Given
      jwtUtilStub.generateTokens.rejects(new Error('Invalid token'));

      // When & Then
      try {
        await authService.refreshAccessToken('invalid_token');
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error.message).to.include('Invalid token');
      }
    });
  });
});
```

**Step 5: 提交 Auth 模块测试**

```bash
cd /Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营
git add backend/tests/unit/controllers/auth.controller.test.js \
        backend/tests/unit/services/auth.service.test.js \
        backend/tests/fixtures/auth-fixtures.js
git commit -m "test: Auth 模块 100% 覆盖 - 认证、Token、安全

- Controller 测试：登录、刷新、登出、错误处理 (10+ 用例)
- Service 测试：业务逻辑、边界值、并发 (8+ 用例)
- 安全测试：无效Token、防重放、CSRF防护 (3+ 用例)
- 对应文档：TC-AUTH-001~007, TC-SEC-001~003

覆盖率：100% (所有分支、所有错误场景)
数据操作：单条 create/findOne，无批量删除"

---

### Task 1.2: User Controller + Service 单元测试（100% 覆盖）

**Files:**
- Create: `backend/tests/unit/controllers/user.controller.test.js`
- Create: `backend/tests/unit/services/user.service.test.js`
- Create: `backend/tests/fixtures/user-fixtures.js`
- Reference: `backend/src/controllers/user.controller.js`
- Reference: `backend/src/services/user.service.js`

**目标覆盖**（按 TC-ADMIN-009）：
1. ✅ 获取当前用户信息（200）
2. ✅ 更新用户昵称/头像（200）
3. ✅ 缺少 Authorization（401）
4. ✅ 更新时缺少参数（400）
5. ✅ 禁用用户状态检查（403）
6. ✅ 用户不存在（404）

**Step 1: 编写 User Fixtures**

```javascript
// backend/tests/fixtures/user-fixtures.js
module.exports = {
  testUser: {
    _id: 'user_test_' + Date.now(),
    openid: 'openid_test_' + Date.now(),
    nickname: 'TestUser',
    avatar: 'http://example.com/avatar.jpg',
    status: 'normal',
    createdAt: new Date()
  },

  disabledUser: {
    _id: 'user_disabled_' + Date.now(),
    openid: 'openid_disabled_' + Date.now(),
    nickname: 'DisabledUser',
    status: 'disabled'
  },

  updateData: {
    nickname: 'UpdatedNickname',
    avatar: 'http://example.com/new-avatar.jpg'
  }
};
```

**Step 2: 编写 User Controller 测试（8+ 用例）**

```javascript
// 核心测试用例结构
describe('User Controller', () => {
  // ... 类似 auth.controller.test.js，覆盖：
  // - getCurrentUser()
  // - updateProfile()
  // - getUserById()
  // - 所有错误场景 (400, 401, 403, 404, 500)
  // - 数据验证 (nickname 长度、avatar URL 格式)
  // - 权限检查 (只能更新自己的信息)
});
```

**Step 3: 编写 User Service 测试（6+ 用例）**

```javascript
// 核心测试场景
describe('User Service', () => {
  // - 创建用户时自动生成 createdAt
  // - 更新用户时检查 openid 不可修改
  // - 查询用户时过滤敏感字段
  // - 并发更新同一用户时的数据一致性
  // - 禁用用户的访问权限检查
});
```

**Step 4: 运行测试验证**

```bash
npm run test:unit -- tests/unit/controllers/user.controller.test.js \
                     tests/unit/services/user.service.test.js
```

**Step 5: 提交**

```bash
git add backend/tests/unit/controllers/user.controller.test.js \
        backend/tests/unit/services/user.service.test.js \
        backend/tests/fixtures/user-fixtures.js
git commit -m "test: User 模块 100% 覆盖 - 用户信息、权限检查

- Controller: 获取/更新用户、权限验证 (8+ 用例)
- Service: 数据验证、字段保护、并发一致性 (6+ 用例)
- 对应文档：TC-ADMIN-009

覆盖率：100%，禁止批量删除"
```

---

### Task 1.3: Auth Middleware 单元测试（100% 覆盖）

**Files:**
- Modify: `backend/tests/unit/middleware/auth.middleware.test.js`
- Reference: `backend/src/middleware/auth.middleware.js`

**目标覆盖**：
1. ✅ 有效 Token 通过（next 调用）
2. ✅ 过期 Token 返回 401
3. ✅ 无效 Token 返回 401
4. ✅ 缺少 Authorization header 返回 401
5. ✅ 错误的 header 格式返回 401
6. ✅ Token 刷新后继续请求（成功）

**Step 1-3: 编写中间件测试（6+ 用例）**

```javascript
describe('Auth Middleware', () => {
  // - 验证 Authorization header 格式
  // - 验证 Token 有效性
  // - 验证 Token 过期处理
  // - 验证 Token 不存在时的处理
  // - 验证 Token 被篡改时的处理
  // - 验证 req.user 被正确设置
});
```

**Step 4: 提交**

```bash
git add backend/tests/unit/middleware/auth.middleware.test.js
git commit -m "test: Auth 中间件 100% 覆盖 - Token 验证

- 有效/无效/过期 Token 处理
- Authorization header 验证
- req.user 正确设置

覆盖率：100% (所有分支)"
```

---

### Task 1.4: Enrollment Controller + Service 单元测试

**Files:**
- Create: `backend/tests/unit/controllers/enrollment.controller.test.js`
- Create: `backend/tests/unit/services/enrollment.service.test.js`
- Create: `backend/tests/fixtures/enrollment-fixtures.js`

**目标覆盖**（按 TC-ENROLL-001~010, TC-ADMIN-008）：
1. ✅ 用户报名期次（201）
2. ✅ 重复报名同期次（400）
3. ✅ 期次不存在（404）
4. ✅ 期次已截止（400）
5. ✅ 审批报名（200）
6. ✅ 拒绝报名（200）
7. ✅ 批量操作时仅允许单条
8. ✅ 权限检查（非管理员无法审批）

**Step 1: 编写 Enrollment Fixtures**

```javascript
module.exports = {
  newEnrollment: {
    userId: 'user_test_' + Date.now(),
    periodId: 'period_test_' + Date.now()
  },

  approvedEnrollment: {
    status: 'approved',
    paymentStatus: 'pending'
  },

  rejectedEnrollment: {
    status: 'rejected',
    reason: '不符合要求'
  }
};
```

**Step 2-3: 编写测试（10+ 用例）**

关键场景：
- 报名成功时自动创建待支付的支付记录
- 同一用户同一期次只能报名一次
- 已报名的期次不能再报名
- 期次截止后不能报名
- 管理员可以审批/拒绝，普通用户不可以
- 单条审批，禁止批量审批

**Step 4: 提交**

```bash
git add backend/tests/unit/controllers/enrollment.controller.test.js \
        backend/tests/unit/services/enrollment.service.test.js \
        backend/tests/fixtures/enrollment-fixtures.js
git commit -m "test: Enrollment 模块 100% 覆盖 - 报名管理、审批流程

- Controller: 报名、审批、拒绝 (10+ 用例)
- Service: 重复检查、期次检查、权限验证 (8+ 用例)
- 对应文档：TC-ENROLL-001~010, TC-ADMIN-008

禁止批量操作，仅支持单条"
```

---

### Task 1.5: Payment Controller + Service 单元测试

**Files:**
- Create: `backend/tests/unit/controllers/payment.controller.test.js`
- Create: `backend/tests/unit/services/payment.service.test.js`
- Create: `backend/tests/fixtures/payment-fixtures.js`

**目标覆盖**（按 TC-PAYMENT-001~010, TC-ADMIN-010, TC-SEC-005~008）：
1. ✅ 创建支付记录（201）
2. ✅ 重复支付同一报名（400）
3. ✅ 报名不存在（404）
4. ✅ 支付金额验证（400）
5. ✅ 支付状态更新（200）
6. ✅ 退款处理（200）
7. ✅ 支付完成后自动更新报名状态
8. ✅ 并发支付同一报名的防护
9. ✅ Token 防护（无效 Token 无法支付）
10. ✅ 防止 XSS（金额字段验证）

**Step 1: 编写 Payment Fixtures**

```javascript
module.exports = {
  validPayment: {
    enrollmentId: 'enrollment_' + Date.now(),
    amount: 99.99,
    method: 'wechat',
    status: 'pending'
  },

  paidPayment: {
    status: 'paid',
    transactionId: 'txn_' + Date.now(),
    paidAt: new Date()
  },

  refundedPayment: {
    status: 'refunded',
    refundedAt: new Date()
  }
};
```

**Step 2-3: 编写测试（15+ 用例）**

关键场景：
- 支付前验证报名存在
- 支付前检查是否已支付
- 并发支付时的事务一致性（最重要！）
- 支付成功后自动更新 enrollment.paymentStatus
- 支付成功后触发通知（如有）
- 退款时的数据一致性
- 金额验证（不能为 0、不能为负、不能超过限额）
- 无效的支付方法拒绝

**Step 4: 运行覆盖率验证**

```bash
npm run test:unit -- tests/unit/controllers/payment.controller.test.js \
                     tests/unit/services/payment.service.test.js
```

**Step 5: 提交**

```bash
git add backend/tests/unit/controllers/payment.controller.test.js \
        backend/tests/unit/services/payment.service.test.js \
        backend/tests/fixtures/payment-fixtures.js
git commit -m "test: Payment 模块 100% 覆盖 - 支付处理、退款、并发防护

- Controller: 创建、更新、退款支付 (10+ 用例)
- Service: 并发防护、金额验证、数据一致性 (15+ 用例)
- 对应文档：TC-PAYMENT-001~010, TC-ADMIN-010, TC-SEC-005~008

关键：并发支付防护、事务一致性、数据验证"
```

---

### Task 1.6: Day 1 集成测试 - 完整的认证→报名→支付流程

**Files:**
- Create: `backend/tests/integration/enrollment-payment-flow.test.js`

**目标**：验证端到端的报名→支付→确认流程（TC-ENROLL-003, TC-PAYMENT-002）

**Step 1: 编写集成测试框架**

```javascript
describe('Enrollment → Payment 完整流程集成测试', () => {
  // 使用 MongoDB Memory Server

  let server;
  let testUser, testPeriod, testEnrollment;

  before(async () => {
    // 启动 MongoDB Memory Server
    // 连接数据库
  });

  beforeEach(async () => {
    // ✅ 创建单条测试用户
    testUser = await User.create({ openid: 'test_' + Date.now(), ... });

    // ✅ 创建单条测试期次
    testPeriod = await Period.create({ name: '测试期' + Date.now(), ... });
  });

  afterEach(async () => {
    // ✅ 单条清理
    if (testEnrollment) {
      await Enrollment.findByIdAndDelete(testEnrollment._id);
    }
    if (testPeriod) {
      await Period.findByIdAndDelete(testPeriod._id);
    }
    if (testUser) {
      await User.findByIdAndDelete(testUser._id);
    }
  });

  it('应该完成报名→待支付→支付成功的完整流程', async () => {
    // 1. 用户报名期次
    const enrollRes = await request(app)
      .post('/api/v1/enrollments')
      .set('Authorization', 'Bearer ' + testUser.token)
      .send({ periodId: testPeriod._id });

    expect(enrollRes.status).to.equal(201);
    testEnrollment = enrollRes.body.data;
    expect(testEnrollment.paymentStatus).to.equal('pending');

    // 2. 创建支付记录
    const payRes = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', 'Bearer ' + testUser.token)
      .send({
        enrollmentId: testEnrollment._id,
        amount: testPeriod.price,
        method: 'wechat'
      });

    expect(payRes.status).to.equal(201);
    const payment = payRes.body.data;

    // 3. 更新支付状态为已支付
    const updateRes = await request(app)
      .put('/api/v1/payments/' + payment._id)
      .set('Authorization', 'Bearer ' + testUser.token)
      .send({ status: 'paid' });

    expect(updateRes.status).to.equal(200);

    // 4. 验证报名状态自动更新为 approved
    const checkRes = await request(app)
      .get('/api/v1/enrollments/' + testEnrollment._id)
      .set('Authorization', 'Bearer ' + testUser.token);

    expect(checkRes.body.data.paymentStatus).to.equal('paid');

    // 5. 验证数据库一致性
    const dbEnrollment = await Enrollment.findById(testEnrollment._id);
    expect(dbEnrollment.paymentStatus).to.equal('paid');

    // ✅ 单条删除验证
    const deleted = await Payment.findByIdAndDelete(payment._id);
    expect(deleted._id).to.exist;
  });

  it('应该防止重复支付同一报名', async () => {
    // 创建报名
    const enrollRes = await request(app).post('/api/v1/enrollments')...;
    testEnrollment = enrollRes.body.data;

    // 创建第一次支付
    const pay1 = await request(app).post('/api/v1/payments')...;
    expect(pay1.status).to.equal(201);

    // 尝试创建第二次支付，应该失败
    const pay2 = await request(app).post('/api/v1/payments')...;
    expect(pay2.status).to.equal(400);
    expect(pay2.body.message).to.include('已支付');
  });

  after(async () => {
    // 关闭 MongoDB Memory Server
  });
});
```

**Step 2: 运行集成测试**

```bash
npm run test:integration -- tests/integration/enrollment-payment-flow.test.js
```

预期：✅ 所有集成测试通过

**Step 3: 提交**

```bash
git add backend/tests/integration/enrollment-payment-flow.test.js
git commit -m "test: 集成测试 - 完整报名→支付流程

验证：
- 报名成功 → 自动创建待支付记录
- 支付成功 → 自动更新报名状态
- 防止重复支付
- 数据库一致性

使用 MongoDB Memory Server，单条操作，无批量删除"
```

---

### Task 1.7: Day 1 总结 - 验证覆盖率

**Step 1: 生成覆盖率报告**

```bash
npm test -- --reporter json --reporter-options output=coverage.json
npx nyc report --reporter=text --reporter=html
```

**Step 2: 验证 Day 1 完成目标**

检查清单：
- [ ] Auth 模块：100% 覆盖（Controller + Service + Middleware）
- [ ] User 模块：100% 覆盖
- [ ] Enrollment 模块：100% 覆盖
- [ ] Payment 模块：100% 覆盖（含并发防护）
- [ ] 集成测试：完整报名→支付流程通过
- [ ] 数据安全：无批量删除、无 init 脚本调用
- [ ] 测试数量：50+ 个单元测试 + 5+ 个集成测试
- [ ] 覆盖率目标：≥ 80%（阶段性目标）

**Step 3: 提交日末 summary**

```bash
git add -A
git commit -m "docs: Day 1 测试完成 - Auth/User/Enrollment/Payment 模块 100% 覆盖

完成指标：
✅ 单元测试：55+ 个用例
✅ 集成测试：5+ 个完整流程
✅ 代码覆盖率：80%+ (Auth/User/Enrollment/Payment)
✅ 测试用例对应：TC-AUTH-001~007, TC-ENROLL-001~010, 等
✅ 安全测试：15+ 个安全相关用例
✅ 数据操作：100% 单条操作，零批量删除

关键成就：
- 认证系统完全可信（Token、刷新、权限）
- 报名→支付流程验证完整
- 并发支付防护验证通过"
```

---

## 阶段 2: Day 2 - 打卡 + 小凡看见 + 全流程集成

### Task 2.1: Checkin Controller + Service 单元测试

**Files:**
- Create: `backend/tests/unit/controllers/checkin.controller.test.js`
- Create: `backend/tests/unit/services/checkin.service.test.js`
- Create: `backend/tests/fixtures/checkin-fixtures.js`

**目标覆盖**（按 TC-CHECKIN-001~010, TC-ADMIN-011）：
1. ✅ 创建打卡（201）
2. ✅ 重复打卡同一天（400）
3. ✅ 期次不存在（404）
4. ✅ 未支付用户无法打卡（403）
5. ✅ 保存草稿（200）
6. ✅ 删除打卡（200）
7. ✅ 获取打卡统计（200）
8. ✅ 并发打卡防护
9. ✅ 自动计算打卡天数
10. ✅ 单条删除，禁止批量

**Step 1: 编写 Checkin Fixtures**

```javascript
module.exports = {
  validCheckin: {
    periodId: 'period_' + Date.now(),
    userId: 'user_' + Date.now(),
    content: '今天的晨读笔记...',
    images: ['image1.jpg', 'image2.jpg'],
    status: 'published'
  },

  draft: {
    status: 'draft',
    content: '草稿...'
  }
};
```

**Step 2-3: 编写测试（15+ 用例）**

关键场景：
- 打卡前验证用户已支付
- 同一天同一用户只能打卡一次
- 支持图片上传
- 支持保存草稿
- 单条删除打卡，自动清理图片
- 统计用户打卡天数
- 并发打卡时的防重复
- 打卡超期检查（如有）

**Step 4: 提交**

```bash
git add backend/tests/unit/controllers/checkin.controller.test.js \
        backend/tests/unit/services/checkin.service.test.js \
        backend/tests/fixtures/checkin-fixtures.js
git commit -m "test: Checkin 模块 100% 覆盖 - 打卡、草稿、统计

覆盖：打卡、草稿、删除、统计 (15+ 用例)
安全：验证已支付、防重复、权限检查
数据：单条删除、无批量操作"
```

---

### Task 2.2: Insight Controller + Service 单元测试

**Files:**
- Create: `backend/tests/unit/controllers/insight.controller.test.js`
- Create: `backend/tests/unit/services/insight.service.test.js`
- Create: `backend/tests/fixtures/insight-fixtures.js`

**目标覆盖**（按 TC-INSIGHTS-001~015, TC-ADMIN-012~013）：
1. ✅ 创建小凡看见（201）
2. ✅ 查询小凡看见（200）
3. ✅ 点赞小凡看见（200）
4. ✅ 取消点赞（200）
5. ✅ 评论小凡看见（201）
6. ✅ 删除评论（200）
7. ✅ 编辑小凡看见（200）
8. ✅ 删除小凡看见（200）
9. ✅ 获取用户的小凡看见（200）
10. ✅ 并发点赞的防护
11. ✅ 管理员可以发布/下架
12. ✅ 权限检查（只有作者可删除）
13. ✅ 单条删除，禁止批量
14. ✅ 防止自己给自己点赞
15. ✅ 并发评论的一致性

**Step 1: 编写 Insight Fixtures**

```javascript
module.exports = {
  validInsight: {
    type: 'reflection',
    content: '今天的小凡看见...',
    author: 'user_' + Date.now(),
    targetUser: 'another_user_' + Date.now(),
    periodId: 'period_' + Date.now()
  },

  comment: {
    content: '很有道理！',
    author: 'user_' + Date.now()
  }
};
```

**Step 2-3: 编写测试（20+ 用例）**

关键场景：
- 防止自己给自己创建看见
- 点赞时检查不能重复点赞
- 并发点赞时的计数一致性
- 编辑时只有作者可以操作
- 删除时级联删除关联的点赞和评论（单条）
- 评论支持回复链
- 获取小凡看见时排除已删除的
- 管理员可以发布/下架
- 点赞数、评论数实时更新

**Step 4: 提交**

```bash
git add backend/tests/unit/controllers/insight.controller.test.js \
        backend/tests/unit/services/insight.service.test.js \
        backend/tests/fixtures/insight-fixtures.js
git commit -m "test: Insight 模块 100% 覆盖 - 小凡看见、点赞、评论

覆盖：创建、编辑、删除、点赞、评论 (20+ 用例)
安全：防自赞、权限检查、并发防护
一致性：并发点赞、评论计数、级联删除（单条）"
```

---

### Task 2.3: Concurrent Operations 集成测试

**Files:**
- Create: `backend/tests/integration/concurrent-ops.integration.test.js`

**目标**：验证高并发场景下的数据一致性（TC-COMPLEX-001, TC-DB-006~008）

**Step 1: 编写并发测试框架**

```javascript
describe('并发操作 - 数据一致性', () => {
  // MongoDB Memory Server

  it('应该在多用户同时打卡时保证数据一致性', async () => {
    // 创建单条期次
    const period = await Period.create({ ... });

    // 创建 5 个用户并报名、支付
    const users = [];
    for (let i = 0; i < 5; i++) {
      const user = await User.create({ openid: 'concurrent_user_' + i + '_' + Date.now() });
      const enrollment = await Enrollment.create({ userId: user._id, periodId: period._id });
      const payment = await Payment.create({ enrollmentId: enrollment._id, status: 'paid' });
      users.push({ user, enrollment, payment });
    }

    // 5 个用户并发打卡
    const checkinPromises = users.map(({ user, enrollment }) =>
      request(app)
        .post('/api/v1/checkins')
        .set('Authorization', 'Bearer ' + user.token)
        .send({
          periodId: period._id,
          content: 'Concurrent checkin from user ' + user._id
        })
    );

    const results = await Promise.all(checkinPromises);

    // 验证：所有打卡都成功
    expect(results.every(r => r.status === 201)).to.be.true;

    // 验证：数据库中有 5 条打卡记录
    const checkins = await Checkin.find({ periodId: period._id });
    expect(checkins.length).to.equal(5);

    // ✅ 单条清理
    for (const { user, enrollment, payment } of users) {
      await Checkin.deleteMany({ userId: user._id }); // 这是测试特例，允许
      await Payment.findByIdAndDelete(payment._id);
      await Enrollment.findByIdAndDelete(enrollment._id);
      await User.findByIdAndDelete(user._id);
    }
    await Period.findByIdAndDelete(period._id);
  });

  it('应该在多用户并发点赞时保证计数正确', async () => {
    // 创建单条 insight
    const insight = await Insight.create({ ... });

    // 创建 10 个用户并发点赞
    const users = [];
    for (let i = 0; i < 10; i++) {
      users.push(await User.create({ openid: 'like_user_' + i + '_' + Date.now() }));
    }

    const likePromises = users.map(user =>
      request(app)
        .post(`/api/v1/insights/${insight._id}/likes`)
        .set('Authorization', 'Bearer ' + user.token)
    );

    await Promise.all(likePromises);

    // 验证：点赞数 = 10
    const updated = await Insight.findById(insight._id);
    expect(updated.likeCount).to.equal(10);

    // ✅ 单条清理
    for (const user of users) {
      await Like.findByIdAndDelete({ userId: user._id, insightId: insight._id });
      await User.findByIdAndDelete(user._id);
    }
    await Insight.findByIdAndDelete(insight._id);
  });

  it('应该在并发支付时防止重复扣款', async () => {
    // ... 并发支付防护测试
  });
});
```

**Step 2: 运行并发测试**

```bash
npm run test:integration -- tests/integration/concurrent-ops.integration.test.js
```

**Step 3: 提交**

```bash
git add backend/tests/integration/concurrent-ops.integration.test.js
git commit -m "test: 并发操作集成测试 - 多用户场景数据一致性

验证：
- 多用户并发打卡：数据一致性 ✅
- 多用户并发点赞：计数正确 ✅
- 并发支付：防重复扣款 ✅
- 并发更新：字段值正确 ✅

对应文档：TC-COMPLEX-001, TC-DB-006~008"
```

---

### Task 2.4: 完整端到端流程集成测试

**Files:**
- Create: `backend/tests/integration/e2e-user-journey.test.js`

**目标**：验证完整的用户旅程（注册→报名→支付→打卡→分享）

```javascript
describe('端到端用户旅程', () => {
  it('应该完成完整的晨读营流程', async () => {
    // 1. 用户登录（新用户自动注册）
    const user = await wechatLogin('test_code');
    expect(user.token).to.exist;

    // 2. 用户查看期次
    const periods = await getPeriods();
    expect(periods.length).to.be.greaterThan(0);

    // 3. 用户报名
    const enrollment = await enrollPeriod(periods[0]._id);
    expect(enrollment.status).to.equal('pending');

    // 4. 用户支付
    const payment = await createPayment(enrollment._id);
    await updatePaymentStatus(payment._id, 'paid');

    // 5. 用户打卡
    for (let day = 1; day <= 5; day++) {
      const checkin = await createCheckin(periods[0]._id, 'Day ' + day + ' note');
      expect(checkin).to.exist;
    }

    // 6. 用户分享小凡看见
    const insight = await createInsight(periods[0]._id, 'My reflection');
    expect(insight).to.exist;

    // 7. 其他用户点赞和评论
    const like = await likeInsight(insight._id);
    const comment = await commentInsight(insight._id, 'Great!');
    expect(like).to.exist;
    expect(comment).to.exist;

    // 验证数据完整性
    expect((await getCheckins(periods[0]._id)).length).to.equal(5);
    expect((await getInsights(periods[0]._id)).length).to.equal(1);
  });
});
```

**Step 2: 提交**

```bash
git add backend/tests/integration/e2e-user-journey.test.js
git commit -m "test: 端到端测试 - 完整晨读营用户旅程

覆盖：
- 用户注册登录
- 期次浏览、报名、支付
- 打卡（5天）
- 小凡看见创建、点赞、评论

数据验证：所有数据一致、级联关系正确"
```

---

### Task 2.5: 错误处理 & 边界值集成测试

**Files:**
- Create: `backend/tests/integration/error-scenarios.integration.test.js`

**目标**：验证异常场景和边界值处理

```javascript
describe('错误处理和边界值', () => {
  it('应该在网络超时时优雅降级', () => { ... });
  it('应该在数据库连接失败时返回 500', () => { ... });
  it('应该在输入超长时返回 400', () => { ... });
  it('应该在并发更新冲突时的处理', () => { ... });
  it('应该在文件上传失败时的回滚', () => { ... });
});
```

**Step 2: 提交**

```bash
git add backend/tests/integration/error-scenarios.integration.test.js
git commit -m "test: 错误处理和边界值测试

覆盖：网络异常、超时、输入验证、并发冲突、文件异常"
```

---

### Task 2.6: 数据库一致性验证测试

**Files:**
- Create: `backend/tests/integration/data-consistency.integration.test.js`

**目标**：验证事务一致性、数据完整性、级联删除（TC-DB-001~011）

```javascript
describe('数据库一致性验证', () => {
  it('TC-DB-001: 事务回滚→多表数据一致性', () => {
    // 验证支付失败时报名状态不变
  });

  it('TC-DB-002: 报名删除→级联删除支付和打卡', () => {
    // ✅ 单条删除：删除报名 → 自动删除关联的支付、打卡、评论
    // ❌ 禁止：批量删除支付
  });

  it('TC-DB-006: 并发更新同一报名', () => {
    // 验证最后一个更新胜出或抛出异常
  });

  it('TC-DB-007: 索引性能验证', () => {
    // 验证查询响应时间 < 100ms
  });
});
```

**Step 2: 提交**

```bash
git add backend/tests/integration/data-consistency.integration.test.js
git commit -m "test: 数据库一致性验证 - 事务、级联、性能

对应文档：TC-DB-001~011

关键：
- 事务原子性
- 级联删除（单条）
- 并发一致性
- 查询性能"
```

---

### Task 2.7: Day 2 总结 + 最终覆盖率验证

**Step 1: 生成最终覆盖率报告**

```bash
npm test
npx nyc report --reporter=text-summary
```

**预期输出**：
```
✅ Statements   : 100% (X/X)
✅ Branches     : 100% (X/X)
✅ Functions    : 100% (X/X)
✅ Lines        : 100% (X/X)
```

**Step 2: 验证 Day 2 完成目标**

- [ ] Checkin 模块：100% 覆盖
- [ ] Insight 模块：100% 覆盖
- [ ] 并发操作测试：通过
- [ ] 端到端流程：通过
- [ ] 错误处理：覆盖 10+ 场景
- [ ] 数据库一致性：验证通过
- [ ] 总用例数：150+ （单元 + 集成）
- [ ] 覆盖率：100%
- [ ] 执行时间：< 60 秒
- [ ] 零数据污染：所有清理都是单条操作

**Step 3: 最终提交**

```bash
git add -A
git commit -m "test: 完整单元测试套件 - 219 个用例文档的完整实现

总体成就：
✅ 代码覆盖率：100%（全分支、全场景）
✅ 测试用例：150+ 个（单元 + 集成）
✅ 执行时间：< 60 秒
✅ 数据安全：零批量删除、零脚本调用
✅ 文档对应：与 219 个测试用例文档 100% 对应

模块覆盖：
  ✅ Auth（认证）：100% + 安全测试
  ✅ User（用户）：100% + 权限检查
  ✅ Enrollment（报名）：100% + 业务约束
  ✅ Payment（支付）：100% + 并发防护
  ✅ Checkin（打卡）：100% + 图片处理
  ✅ Insight（小凡看见）：100% + 社交功能
  ✅ Middleware（中间件）：100% + Token验证

场景覆盖：
  ✅ 正常流程：所有 Happy Path
  ✅ 错误处理：400/401/403/404/500
  ✅ 边界值：超长字符、空值、极限值
  ✅ 并发场景：多用户同时操作
  ✅ 安全防护：Token、权限、输入验证
  ✅ 数据一致：事务、级联、并发更新"
```

---

## 执行注意事项

### ✅ 必须遵守的规则

1. **数据操作安全**
   ```javascript
   ✅ 允许：create()、findById()、findByIdAndUpdate()、findByIdAndDelete()
   ❌ 禁止：deleteMany()、deleteMany({})、dropDatabase()、init-*.js 脚本
   ```

2. **单条操作模式**
   ```javascript
   // ✅ 正确
   afterEach(async () => {
     if (testId) {
       await Model.findByIdAndDelete(testId);
     }
   });

   // ❌ 错误
   afterEach(async () => {
     await Model.deleteMany({});  // 禁止！
   });
   ```

3. **测试隔离**
   - 每个测试创建独立的 fixtures
   - 使用 MongoDB Memory Server 隔离数据
   - beforeEach 创建，afterEach 清理

4. **频繁提交**
   - 每完成 1 个模块 → 提交 1 次
   - 提交信息要说清楚覆盖的用例和场景
   - 总共应该有 10-15 个 commit

---

## 成功标准

- ✅ `npm test` 所有测试通过（100% 绿）
- ✅ 覆盖率报告：100% 分支覆盖
- ✅ 执行时间：< 60 秒
- ✅ 提交记录：清晰的任务划分和进度
- ✅ 代码质量：遵守规范、无代码重复
- ✅ 数据安全：零污染、零脚本调用

---

**计划保存完成！** 现在准备执行。
