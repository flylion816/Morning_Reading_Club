const axios = require('axios');

// 环境配置
const API_BASE = 'http://localhost:3000/api/v1';

// 测试数据
const testUserId = '6915e741c4fbb40316417089'; // 阿泰
const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTE1ZTc0MWM0ZmJiNDAzMTY0MTcwODkiLCJvcGVuaWQiOiJvMm91YVlrR3kycHVvS3lqd3htanJJSEJ6U19LNWQ4WVJYTk95TTZfUDhaIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3MzA0NDcxMDksImV4cCI6MTczMTA1MjkwOX0.Ac1n39pTfCJ4xEMnVF8aZ9ItOjEV8h5RHXmN_W0j5I0';

// 1. 获取所有期次
async function getPeriods() {
  try {
    console.log('\n========== 1️⃣ 获取所有期次 ==========');
    const res = await axios.get(API_BASE + '/courses/periods', {
      headers: { Authorization: 'Bearer ' + testToken }
    });
    const periods = res.data.data || res.data;
    console.log('✅ 期次列表:');
    periods.forEach(p => {
      console.log('   - ' + (p.name || p.title) + ' (ID: ' + p._id + ', status: ' + p.status + ')');
    });
    return periods;
  } catch (err) {
    console.error('❌ 获取期次失败:', err.message);
    return [];
  }
}

// 2. 获取平衡之道期次的小凡看见
async function getInsightsForPeriod(periodId) {
  try {
    console.log('\n========== 2️⃣ 获取期次的小凡看见 ==========');
    console.log('   periodId: ' + periodId);
    const res = await axios.get(API_BASE + '/insights/period/' + periodId, {
      headers: { Authorization: 'Bearer ' + testToken }
    });
    const data = res.data.data || res.data;
    console.log('✅ 返回数据结构:');
    console.log('   - list 数量: ' + (data.list?.length || 0));
    console.log('   - pagination: ' + JSON.stringify(data.pagination));

    if (data.list && data.list.length > 0) {
      console.log('\n📋 详细数据:');
      data.list.forEach((insight, idx) => {
        console.log('\n   [' + (idx + 1) + '] ' + insight._id);
        console.log('       - content: ' + (insight.content?.substring(0, 50) || 'N/A') + '...');
        console.log('       - type: ' + insight.type);
        console.log('       - userId: ' + (insight.userId?._id || insight.userId));
        console.log('       - targetUserId: ' + (insight.targetUserId?._id || insight.targetUserId));
        console.log('       - createdAt: ' + insight.createdAt);
      });
    } else {
      console.log('⚠️  没有返回任何数据');
    }

    return data;
  } catch (err) {
    console.error('❌ 获取小凡看见失败:', err.message);
    if (err.response?.data) {
      console.error('   响应:', JSON.stringify(err.response.data, null, 2));
    }
    return null;
  }
}

// 主测试流程
async function runTests() {
  console.log('🧪 开始测试小凡看见API...\n');
  console.log('用户ID: ' + testUserId);
  console.log('API地址: ' + API_BASE);

  const periods = await getPeriods();
  const balancePeriod = periods.find(p => p.name === '平衡之道' || p.title === '平衡之道');

  if (balancePeriod) {
    await getInsightsForPeriod(balancePeriod._id);
  } else {
    console.log('\n⚠️ 未找到"平衡之道"期次');
  }
}

runTests();
