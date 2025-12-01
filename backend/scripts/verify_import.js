#!/usr/bin/env node

const mongoose = require('mongoose');
const Section = require('../src/models/Section');
const Period = require('../src/models/Period');

const mongoUrl = 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';

async function verify() {
  try {
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    const period = await Period.findOne({ name: '平衡之道' });
    if (!period) {
      console.error('❌ 找不到期次');
      await mongoose.disconnect();
      process.exit(1);
    }

    const sections = await Section.find({ periodId: period._id }).sort({ day: 1 });
    
    console.log('\n========================================');
    console.log('   验证导入结果');
    console.log('========================================\n');
    console.log(`📊 总计导入: ${sections.length} 条记录\n`);
    console.log('Day  │ 标题                      │ 字数');
    console.log('─────┼──────────────────────────┼────');
    
    sections.forEach(s => {
      const titleStr = (s.title || '').substring(0, 24).padEnd(24);
      const charCount = (s.content || '').length;
      console.log(`${String(s.day).padStart(2, '0')}  │ ${titleStr} │ ${String(charCount).padStart(4)}`);
    });
    
    console.log('\n========================================');
    if (sections.length === 23) {
      console.log('✅ 验证成功！所有23条记录导入完成');
    } else {
      console.log(`⚠️  预期23条，实际${sections.length}条`);
    }
    console.log('========================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

verify();
