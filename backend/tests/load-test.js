/**
 * 性能和负载测试脚本
 * 使用 Node.js 原生 http 模块进行并发请求测试
 *
 * 运行方式：node backend/tests/load-test.js
 */

const http = require('http');
const https = require('https');

const API_BASE_URL = 'http://localhost:3000/api/v1';
let adminToken = null;

// 测试配置
const tests = [
  {
    name: '登录 API',
    method: 'POST',
    path: '/auth/login',
    body: { email: 'admin@morningreading.com', password: 'admin123' },
    concurrent: 1,
    iterations: 1
  },
  {
    name: '期次列表查询',
    method: 'GET',
    path: '/periods',
    concurrent: 10,
    iterations: 5
  },
  {
    name: '报名列表查询 (50条)',
    method: 'GET',
    path: '/enrollments?pageSize=50',
    concurrent: 20,
    iterations: 3
  },
  {
    name: '统计数据查询',
    method: 'GET',
    path: '/stats',
    concurrent: 15,
    iterations: 5
  },
  {
    name: '审计日志查询',
    method: 'GET',
    path: '/audit-logs?pageSize=20',
    concurrent: 10,
    iterations: 3
  },
  {
    name: '支付记录查询',
    method: 'GET',
    path: '/payments?pageSize=20',
    concurrent: 10,
    iterations: 3
  }
];

/**
 * 发送 HTTP 请求
 */
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const client = options.url.startsWith('https') ? https : http;

    const req = client.request(options, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          duration,
          data: data ? JSON.parse(data) : null,
          success: res.statusCode >= 200 && res.statusCode < 300
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * 执行单个测试
 */
async function runTest(testConfig) {
  console.log(`\n🧪 开始测试: ${testConfig.name}`);
  console.log(`   并发数: ${testConfig.concurrent}, 迭代数: ${testConfig.iterations}`);

  const results = {
    total: 0,
    success: 0,
    failed: 0,
    durations: [],
    errors: []
  };

  const urlObj = new URL(testConfig.path, API_BASE_URL);

  for (let iter = 0; iter < testConfig.iterations; iter++) {
    const promises = [];

    for (let i = 0; i < testConfig.concurrent; i++) {
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: testConfig.path,
        method: testConfig.method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      // 添加 token（如果可用）
      if (adminToken) {
        options.headers['Authorization'] = `Bearer ${adminToken}`;
      }

      if (testConfig.body) {
        options.body = testConfig.body;
        options.headers['Content-Length'] = JSON.stringify(testConfig.body).length;
      }

      promises.push(
        makeRequest(options)
          .then(res => {
            results.total++;
            if (res.success) {
              results.success++;
              results.durations.push(res.duration);
            } else {
              results.failed++;
              results.errors.push(`HTTP ${res.statusCode}`);
            }

            // 如果是登录请求，保存 token
            if (testConfig.path.includes('login') && res.success) {
              adminToken = res.data?.data?.token;
            }

            return res;
          })
          .catch(err => {
            results.total++;
            results.failed++;
            results.errors.push(err.message);
          })
      );
    }

    // 等待所有并发请求完成
    await Promise.all(promises);
  }

  // 计算统计数据
  if (results.durations.length > 0) {
    results.durations.sort((a, b) => a - b);
    results.min = results.durations[0];
    results.max = results.durations[results.durations.length - 1];
    results.avg = Math.round(
      results.durations.reduce((a, b) => a + b, 0) / results.durations.length
    );
    results.p95 = results.durations[Math.floor(results.durations.length * 0.95)];
    results.p99 = results.durations[Math.floor(results.durations.length * 0.99)];
  }

  return results;
}

/**
 * 格式化结果
 */
function formatResults(testName, results) {
  const successRate = ((results.success / results.total) * 100).toFixed(2);

  console.log(`\n✅ 测试结果: ${testName}`);
  console.log(`   总请求数: ${results.total}`);
  console.log(`   成功: ${results.success} (${successRate}%)`);
  console.log(`   失败: ${results.failed}`);

  if (results.durations.length > 0) {
    console.log(`\n   响应时间统计 (ms):`);
    console.log(`   ├─ 最小: ${results.min}ms`);
    console.log(`   ├─ 平均: ${results.avg}ms`);
    console.log(`   ├─ P95: ${results.p95}ms`);
    console.log(`   ├─ P99: ${results.p99}ms`);
    console.log(`   └─ 最大: ${results.max}ms`);
  }

  if (results.errors.length > 0 && results.errors.length <= 5) {
    console.log(`\n   错误示例:`);
    results.errors.slice(0, 5).forEach(err => {
      console.log(`   ├─ ${err}`);
    });
  }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║         API 性能和负载测试                         ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  const allResults = [];
  const startTime = Date.now();

  for (const testConfig of tests) {
    try {
      const results = await runTest(testConfig);
      formatResults(testConfig.name, results);
      allResults.push({ name: testConfig.name, ...results });
    } catch (err) {
      console.error(`❌ 测试失败: ${testConfig.name}`);
      console.error(`   错误: ${err.message}`);
    }

    // 测试之间等待 500ms
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const totalDuration = Date.now() - startTime;

  // 生成总结报告
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║              性能测试总结报告                       ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  console.log('📊 概览统计:');
  console.log(`   测试场景: ${allResults.length}`);
  console.log(`   总请求数: ${allResults.reduce((sum, r) => sum + r.total, 0)}`);
  console.log(`   成功请求: ${allResults.reduce((sum, r) => sum + r.success, 0)}`);
  console.log(`   失败请求: ${allResults.reduce((sum, r) => sum + r.failed, 0)}`);
  console.log(`   总耗时: ${totalDuration}ms\n`);

  console.log('🎯 性能指标排序 (平均响应时间):\n');
  const sorted = [...allResults].sort((a, b) => a.avg - b.avg);
  sorted.forEach((result, i) => {
    const icon = result.avg < 100 ? '⚡' : result.avg < 500 ? '✅' : '⚠️';
    console.log(`   ${i + 1}. ${icon} ${result.name}: ${result.avg}ms`);
  });

  // 性能评级
  console.log('\n🏆 性能评级:\n');
  const slowTests = sorted.filter(r => r.avg > 500);
  const goodTests = sorted.filter(r => r.avg < 200);

  if (goodTests.length > 0) {
    console.log(`   ✅ 高效 (< 200ms): ${goodTests.length} 个`);
  }
  if (slowTests.length > 0) {
    console.log(`   ⚠️  需优化 (> 500ms): ${slowTests.length} 个`);
    slowTests.forEach(test => {
      console.log(`      - ${test.name}: ${test.avg}ms`);
    });
  }

  // 监测高 P95/P99 的异常延迟
  console.log('\n📈 异常延迟检测:\n');
  let hasAnomaly = false;
  allResults.forEach(result => {
    if (result.p99 > result.avg * 3) {
      console.log(`   ⚠️  ${result.name}: P99 异常高 (${result.p99}ms vs 平均 ${result.avg}ms)`);
      hasAnomaly = true;
    }
  });

  if (!hasAnomaly) {
    console.log('   ✅ 无异常延迟，延迟分布均匀');
  }

  console.log('\n' + '═'.repeat(50) + '\n');
  console.log('📝 建议:\n');

  if (allResults.some(r => r.avg > 500)) {
    console.log('   1. 检查数据库查询性能');
    console.log('   2. 添加适当的索引');
    console.log('   3. 考虑缓存策略\n');
  }

  if (allResults.some(r => r.failed > 0)) {
    console.log('   • 检查错误日志');
    console.log('   • 增加服务器资源\n');
  }

  console.log('✨ 测试完成！\n');

  // 返回测试结果
  return allResults;
}

// 主入口
if (require.main === module) {
  runAllTests().catch(err => {
    console.error('❌ 测试执行失败:', err);
    process.exit(1);
  });
}

module.exports = { runTest, runAllTests };
