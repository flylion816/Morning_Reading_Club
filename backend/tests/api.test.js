/**
 * API 集成测试
 * 测试所有关键的 API 端点
 *
 * 运行方式：npm test
 */

const axios = require('axios');
const assert = require('assert');

const API_BASE_URL = 'http://localhost:3000/api/v1';

// 测试数据
let adminToken = null;
let userId = null;
let periodId = null;
let enrollmentId = null;
let paymentId = null;

describe('API 集成测试', () => {
  // 增加超时时间
  this.timeout(10000);

  describe('1. 认证 API', () => {
    it('应该能成功登录', async () => {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: 'admin@morningreading.com',
        password: 'admin123'
      });

      assert.strictEqual(response.status, 200);
      assert(response.data.data.token, 'Token 应该存在');
      adminToken = response.data.data.token;
      console.log('✓ 登录成功，Token:', adminToken.substring(0, 20) + '...');
    });

    it('应该拒绝错误的密码', async () => {
      try {
        await axios.post(`${API_BASE_URL}/auth/login`, {
          email: 'admin@morningreading.com',
          password: 'wrongpassword'
        });
        throw new Error('应该抛出错误');
      } catch (error) {
        assert(error.response.status >= 400);
        console.log('✓ 错误密码被正确拒绝');
      }
    });
  });

  describe('2. 期次 API', () => {
    it('应该能获取期次列表', async () => {
      const response = await axios.get(`${API_BASE_URL}/periods`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.strictEqual(response.status, 200);
      assert(Array.isArray(response.data.data));
      assert(response.data.data.length > 0, '应该有至少一个期次');
      periodId = response.data.data[0]._id;
      console.log(`✓ 获取期次列表成功，共 ${response.data.data.length} 个期次`);
    });

    it('应该能创建新期次', async () => {
      const response = await axios.post(
        `${API_BASE_URL}/periods`,
        {
          name: '测试期次',
          description: '这是一个测试期次',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          capacity: 100
        },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );

      assert.strictEqual(response.status, 201);
      assert(response.data.data._id);
      console.log('✓ 创建期次成功');
    });
  });

  describe('3. 报名 API', () => {
    it('应该能获取报名列表', async () => {
      const response = await axios.get(`${API_BASE_URL}/enrollments`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        params: { page: 1, pageSize: 10 }
      });

      assert.strictEqual(response.status, 200);
      assert(response.data.data.data, '应该返回数据');
      assert(typeof response.data.data.total === 'number');
      console.log(`✓ 获取报名列表成功，共 ${response.data.data.total} 个报名`);
    });

    it('应该能批量批准报名', async () => {
      // 先获取待审批的报名
      const listResponse = await axios.get(`${API_BASE_URL}/enrollments`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        params: { approvalStatus: 'pending', pageSize: 5 }
      });

      if (listResponse.data.data.data.length === 0) {
        console.log('⊘ 没有待审批的报名，跳过此测试');
        return;
      }

      const enrollmentIds = listResponse.data.data.data.map(e => e._id);

      const response = await axios.post(
        `${API_BASE_URL}/enrollments/batch-approve`,
        { enrollmentIds },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );

      assert.strictEqual(response.status, 200);
      console.log(`✓ 批量批准成功，共 ${enrollmentIds.length} 个报名`);
    });

    it('应该能批量拒绝报名', async () => {
      const listResponse = await axios.get(`${API_BASE_URL}/enrollments`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        params: { approvalStatus: 'pending', pageSize: 3 }
      });

      if (listResponse.data.data.data.length === 0) {
        console.log('⊘ 没有待审批的报名，跳过此测试');
        return;
      }

      const enrollmentIds = listResponse.data.data.data.map(e => e._id);

      const response = await axios.post(
        `${API_BASE_URL}/enrollments/batch-reject`,
        { enrollmentIds, reason: '测试拒绝' },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );

      assert.strictEqual(response.status, 200);
      console.log(`✓ 批量拒绝成功`);
    });
  });

  describe('4. 支付 API', () => {
    it('应该能获取支付记录', async () => {
      const response = await axios.get(`${API_BASE_URL}/payments`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        params: { page: 1, pageSize: 10 }
      });

      assert.strictEqual(response.status, 200);
      assert(response.data.data.data);
      console.log(`✓ 获取支付记录成功，共 ${response.data.data.total} 条`);
    });

    it('应该能按状态筛选支付', async () => {
      const response = await axios.get(`${API_BASE_URL}/payments`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        params: { status: 'completed' }
      });

      assert.strictEqual(response.status, 200);
      if (response.data.data.data.length > 0) {
        assert(response.data.data.data[0].status === 'completed');
      }
      console.log(`✓ 筛选成功，共 ${response.data.data.total} 条已完成支付`);
    });
  });

  describe('5. 数据分析 API', () => {
    it('应该能获取统计数据', async () => {
      const response = await axios.get(`${API_BASE_URL}/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.strictEqual(response.status, 200);
      assert(response.data.data.totalUsers !== undefined);
      assert(response.data.data.totalEnrollments !== undefined);
      console.log(`✓ 获取统计数据成功`);
      console.log(`  - 用户总数: ${response.data.data.totalUsers}`);
      console.log(`  - 报名总数: ${response.data.data.totalEnrollments}`);
    });
  });

  describe('6. 审计日志 API', () => {
    it('应该能获取审计日志', async () => {
      const response = await axios.get(`${API_BASE_URL}/audit-logs`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        params: { page: 1, pageSize: 20 }
      });

      assert.strictEqual(response.status, 200);
      assert(Array.isArray(response.data.data.data));
      console.log(`✓ 获取审计日志成功，共 ${response.data.data.total} 条`);
    });

    it('应该能按操作类型筛选日志', async () => {
      const response = await axios.get(`${API_BASE_URL}/audit-logs`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        params: { actionType: 'BATCH_UPDATE' }
      });

      assert.strictEqual(response.status, 200);
      if (response.data.data.data.length > 0) {
        response.data.data.data.forEach(log => {
          assert(log.actionType === 'BATCH_UPDATE');
        });
      }
      console.log(`✓ 日志筛选成功`);
    });

    it('应该能获取审计统计', async () => {
      const response = await axios.get(`${API_BASE_URL}/audit-logs/statistics`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.strictEqual(response.status, 200);
      assert(response.data.data.total !== undefined);
      assert(response.data.data.today !== undefined);
      console.log(`✓ 获取审计统计成功`);
      console.log(`  - 总操作数: ${response.data.data.total}`);
      console.log(`  - 今日操作数: ${response.data.data.today}`);
      console.log(`  - 失败操作数: ${response.data.data.failed}`);
    });
  });

  describe('7. 错误处理', () => {
    it('应该拒绝未认证的请求', async () => {
      try {
        await axios.get(`${API_BASE_URL}/enrollments`);
        throw new Error('应该返回 401');
      } catch (error) {
        assert.strictEqual(error.response.status, 401);
        console.log('✓ 未认证请求被正确拒绝');
      }
    });

    it('应该处理无效的 Token', async () => {
      try {
        await axios.get(`${API_BASE_URL}/enrollments`, {
          headers: { Authorization: 'Bearer invalid_token' }
        });
        throw new Error('应该返回 401');
      } catch (error) {
        assert(error.response.status === 401 || error.response.status === 403);
        console.log('✓ 无效 Token 被正确拒绝');
      }
    });

    it('应该处理 404 错误', async () => {
      try {
        await axios.get(`${API_BASE_URL}/nonexistent`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        throw new Error('应该返回 404');
      } catch (error) {
        assert.strictEqual(error.response.status, 404);
        console.log('✓ 404 错误被正确处理');
      }
    });
  });

  describe('8. 性能测试', () => {
    it('列表查询应该在 1 秒内完成', async () => {
      const start = Date.now();
      const response = await axios.get(`${API_BASE_URL}/enrollments?pageSize=50`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const duration = Date.now() - start;

      assert(duration < 1000, `查询耗时 ${duration}ms，应该 < 1000ms`);
      console.log(`✓ 列表查询耗时 ${duration}ms`);
    });

    it('统计查询应该在 500ms 内完成', async () => {
      const start = Date.now();
      const response = await axios.get(`${API_BASE_URL}/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const duration = Date.now() - start;

      assert(duration < 500, `查询耗时 ${duration}ms，应该 < 500ms`);
      console.log(`✓ 统计查询耗时 ${duration}ms`);
    });
  });
});

// 测试报告
console.log('\n' + '='.repeat(60));
console.log('API 集成测试完成');
console.log('='.repeat(60) + '\n');
