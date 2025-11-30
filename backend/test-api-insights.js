/**
 * 直接调用后端API来测试阿泰用户是否有平衡之道的insights
 * 用法: node test-api-insights.js
 */

const http = require('http');

// 调用后端API的函数
function callAPI(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testAtaiInsightsViaAPI() {
  try {
    console.log('\n========== 通过API测试阿泰的小凡看见 ==========\n');

    // 1. 首先列出数据库中的所有用户（无需认证）
    console.log('📋 第1步：获取所有用户列表');
    const usersRes = await callAPI('GET', '/api/v1/users?limit=50');

    if (usersRes.status !== 200) {
      console.log(`❌ 获取用户列表失败: ${usersRes.status}`);
      console.log('响应:', usersRes.body);
      process.exit(1);
    }

    const users = usersRes.body?.data?.list || usersRes.body?.data || [];
    console.log(`✅ 找到 ${users.length} 个用户\n`);

    // 查找阿泰用户
    let ataiUser = null;
    let periodId = null;

    for (const user of users) {
      console.log(`  - ${user.nickname || user.name} (ID: ${user._id})`);
      if (user.nickname === '阿泰' || user.name === '阿泰') {
        ataiUser = user;
      }
    }

    if (!ataiUser) {
      console.log('\n❌ 未找到用户"阿泰"');
      console.log('可能的用户昵称:');
      const nicknames = users.map(u => u.nickname || u.name).filter(Boolean);
      console.log(nicknames.join(', '));
      process.exit(1);
    }

    console.log(`\n✅ 找到用户: ${ataiUser.nickname || ataiUser.name} (ID: ${ataiUser._id})\n`);

    // 2. 获取所有期次
    console.log('📋 第2步：获取所有期次列表');
    const periodsRes = await callAPI('GET', '/api/v1/periods?limit=50');

    if (periodsRes.status !== 200) {
      console.log(`❌ 获取期次列表失败: ${periodsRes.status}`);
      console.log('响应:', periodsRes.body);
      process.exit(1);
    }

    const periods = periodsRes.body?.data?.list || periodsRes.body?.data || [];
    console.log(`✅ 找到 ${periods.length} 个期次\n`);

    let balancePeriod = null;
    for (const period of periods) {
      console.log(`  - ${period.name || period.title} (ID: ${period._id})`);
      if ((period.name && period.name.includes('平衡')) || (period.title && period.title.includes('平衡'))) {
        balancePeriod = period;
      }
    }

    if (!balancePeriod) {
      console.log('\n❌ 未找到期次"平衡之道"');
      console.log('可能的期次名称:');
      const names = periods.map(p => p.name || p.title).filter(Boolean);
      console.log(names.join(', '));
      process.exit(1);
    }

    console.log(`\n✅ 找到期次: ${balancePeriod.name || balancePeriod.title} (ID: ${balancePeriod._id})\n`);

    // 3. 获取该期次的所有insights（不需要认证）
    console.log('📋 第3步：获取平衡之道期次的所有insights');
    const insightsUrl = `/api/v1/insights/period/${balancePeriod._id}?limit=100`;

    // 不提供token先试试
    const insightsRes = await callAPI('GET', insightsUrl);

    console.log(`响应状态: ${insightsRes.status}`);

    if (insightsRes.status === 401) {
      console.log('❌ 401未授权 - 需要登录token');
      console.log('这说明路由要求认证。需要提供有效的token进行测试。');
      console.log('\n📝 建议:');
      console.log('1. 在小程序中登录');
      console.log('2. 在小程序console中查看token');
      console.log('3. 使用该token重新运行此脚本');
      process.exit(1);
    }

    if (insightsRes.status !== 200) {
      console.log(`❌ 获取insights失败: ${insightsRes.status}`);
      console.log('响应:', insightsRes.body);
      process.exit(1);
    }

    const insights = insightsRes.body?.data?.list || insightsRes.body?.list || [];
    console.log(`✅ 查询返回 ${insights.length} 条insights\n`);

    if (insights.length === 0) {
      console.log('❌ 该期次没有任何insights记录');
      process.exit(1);
    }

    // 4. 查找阿泰相关的insights
    console.log('📋 第4步：查找阿泰相关的insights');
    const ataiInsights = insights.filter(insight => {
      const userId = insight.userId?._id || insight.userId;
      const targetUserId = insight.targetUserId?._id || insight.targetUserId;
      const ataiId = ataiUser._id;
      return userId === ataiId || targetUserId === ataiId;
    });

    console.log(`✅ 找到 ${ataiInsights.length} 条和阿泰相关的insights\n`);

    if (ataiInsights.length === 0) {
      console.log('⚠️  阿泰在该期次没有任何insights');
      console.log('\n显示该期次的第一条insight作为对比:');
      if (insights.length > 0) {
        const sample = insights[0];
        console.log(JSON.stringify({
          id: sample._id,
          type: sample.type,
          userId: sample.userId?.nickname || sample.userId,
          targetUserId: sample.targetUserId?.nickname || sample.targetUserId,
          createdAt: sample.createdAt
        }, null, 2));
      }
    } else {
      console.log('📋 阿泰的insights详情:');
      ataiInsights.slice(0, 5).forEach((insight, idx) => {
        console.log(`\n${idx + 1}. Insight ID: ${insight._id}`);
        console.log(`   类型: ${insight.type}`);
        const creatorName = insight.userId?.nickname || insight.userId?._id || '未知';
        const targetName = insight.targetUserId?.nickname || insight.targetUserId?._id || 'N/A';
        console.log(`   创建者: ${creatorName}`);
        console.log(`   被分配给: ${targetName}`);
        console.log(`   创建时间: ${insight.createdAt}`);
      });

      console.log('\n✅ 数据验证成功！');
      console.log('\n📝 结论:');
      console.log(`✅ 阿泰确实在${balancePeriod.name || balancePeriod.title}期次有${ataiInsights.length}条小凡看见记录`);
      console.log('✅ 后端API正确返回了用户创建和被分配的insights');
      console.log('⚠️  问题应该在小程序端的数据处理上');
    }

    console.log('\n✅ API测试完成！');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 测试失败:');
    console.error(error.message);
    process.exit(1);
  }
}

testAtaiInsightsViaAPI();
