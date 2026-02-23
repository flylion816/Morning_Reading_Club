/**
 * Period Model 单元测试
 */

const { expect } = require('chai');
const mongoose = require('mongoose');
const Period = require('../../../src/models/Period');

describe('Period Model', () => {
  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
    }
  });

  afterEach(async () => {
    await Period.deleteMany({});
  });

  after(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  describe('Schema Validation', () => {
    it('应该创建有效的期次', async () => {
      const period = await Period.create({
        name: '第一期',
        title: '心流之境',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      expect(period._id).to.exist;
      expect(period.name).to.equal('第一期');
      expect(period.title).to.equal('心流之境');
      expect(period.startDate).to.be.instanceof(Date);
      expect(period.endDate).to.be.instanceof(Date);
    });

    it('应该使用默认值', async () => {
      const period = await Period.create({
        name: '默认期次',
        title: '标题',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      expect(period.subtitle).to.be.null;
      expect(period.description).to.be.null;
      expect(period.icon).to.equal('📚');
      expect(period.coverColor).to.be.null;
      expect(period.coverEmoji).to.equal('📖');
      expect(period.totalDays).to.equal(23);
      expect(period.price).to.equal(0);
      expect(period.originalPrice).to.equal(0);
      expect(period.maxEnrollment).to.be.null;
      expect(period.currentEnrollment).to.equal(0);
      expect(period.enrollmentCount).to.equal(0);
      expect(period.status).to.equal('not_started');
      expect(period.isPublished).to.be.false;
      expect(period.sortOrder).to.equal(0);
      expect(period.checkinCount).to.equal(0);
      expect(period.totalCheckins).to.equal(0);
    });

    it('应该在缺少name时抛出验证错误', async () => {
      try {
        await Period.create({
          title: '标题',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-31')
        });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('name');
      }
    });

    it('应该接受缺少title（title非必需）', async () => {
      const period = await Period.create({
        name: '期次名称',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      expect(period._id).to.exist;
      expect(period.title).to.be.null;
    });

    it('应该在缺少startDate时抛出验证错误', async () => {
      try {
        await Period.create({
          name: '期次',
          title: '标题',
          endDate: new Date('2025-01-31')
        });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('startDate');
      }
    });

    it('应该在缺少endDate时抛出验证错误', async () => {
      try {
        await Period.create({
          name: '期次',
          title: '标题',
          startDate: new Date('2025-01-01')
        });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('endDate');
      }
    });

    it('应该接受有效的status值', async () => {
      const statuses = ['not_started', 'ongoing', 'completed'];
      for (const status of statuses) {
        const period = await Period.create({
          name: `期次_${status}`,
          title: `${status}期次`,
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-31'),
          status
        });
        expect(period.status).to.equal(status);
      }
    });

    it('应该拒绝无效的status值', async () => {
      try {
        await Period.create({
          name: '期次',
          title: '标题',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-31'),
          status: 'invalid_status'
        });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('status');
      }
    });
  });

  describe('Field Constraints', () => {
    it('应该验证name最大长度', async () => {
      try {
        await Period.create({
          name: 'a'.repeat(51),
          title: '标题',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-31')
        });
        expect.fail('应该抛出长度验证错误');
      } catch (err) {
        expect(err.message).to.include('name');
      }
    });

    it('应该验证title最大长度', async () => {
      try {
        await Period.create({
          name: '期次',
          title: 'a'.repeat(101),
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-31')
        });
        expect.fail('应该抛出长度验证错误');
      } catch (err) {
        expect(err.message).to.include('title');
      }
    });

    it('应该验证subtitle最大长度', async () => {
      try {
        await Period.create({
          name: '期次',
          title: '标题',
          subtitle: 'a'.repeat(101),
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-31')
        });
        expect.fail('应该抛出长度验证错误');
      } catch (err) {
        expect(err.message).to.include('subtitle');
      }
    });

    it('应该验证icon最大长度', async () => {
      try {
        await Period.create({
          name: '期次',
          title: '标题',
          icon: 'a'.repeat(11),
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-31')
        });
        expect.fail('应该抛出长度验证错误');
      } catch (err) {
        expect(err.message).to.include('icon');
      }
    });

    it('应该验证totalDays最小值', async () => {
      try {
        await Period.create({
          name: '期次',
          title: '标题',
          totalDays: 0,
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-31')
        });
        expect.fail('应该抛出最小值验证错误');
      } catch (err) {
        expect(err.message).to.include('totalDays');
      }
    });

    it('应该接受totalDays为1', async () => {
      const period = await Period.create({
        name: '期次',
        title: '标题',
        totalDays: 1,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      expect(period.totalDays).to.equal(1);
    });

    it('应该验证price最小值', async () => {
      try {
        await Period.create({
          name: '期次',
          title: '标题',
          price: -1,
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-31')
        });
        expect.fail('应该抛出最小值验证错误');
      } catch (err) {
        expect(err.message).to.include('price');
      }
    });

    it('应该接受price为0（免费）', async () => {
      const period = await Period.create({
        name: '期次',
        title: '标题',
        price: 0,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      expect(period.price).to.equal(0);
    });

    it('应该接受正价格', async () => {
      const period = await Period.create({
        name: '期次',
        title: '标题',
        price: 99.99,
        originalPrice: 199.99,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      expect(period.price).to.equal(99.99);
      expect(period.originalPrice).to.equal(199.99);
    });

    it('应该验证maxEnrollment最小值', async () => {
      try {
        await Period.create({
          name: '期次',
          title: '标题',
          maxEnrollment: -1,
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-31')
        });
        expect.fail('应该抛出最小值验证错误');
      } catch (err) {
        expect(err.message).to.include('maxEnrollment');
      }
    });

    it('应该接受maxEnrollment为null（无限制）', async () => {
      const period = await Period.create({
        name: '期次',
        title: '标题',
        maxEnrollment: null,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      expect(period.maxEnrollment).to.be.null;
    });

    it('应该验证currentEnrollment最小值', async () => {
      try {
        await Period.create({
          name: '期次',
          title: '标题',
          currentEnrollment: -1,
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-31')
        });
        expect.fail('应该抛出最小值验证错误');
      } catch (err) {
        expect(err.message).to.include('currentEnrollment');
      }
    });
  });

  describe('Boolean Fields', () => {
    it('应该接受isPublished为true', async () => {
      const period = await Period.create({
        name: '期次',
        title: '标题',
        isPublished: true,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      expect(period.isPublished).to.be.true;
    });

    it('应该接受isPublished为false', async () => {
      const period = await Period.create({
        name: '期次',
        title: '标题',
        isPublished: false,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      expect(period.isPublished).to.be.false;
    });
  });

  describe('Virtual Fields', () => {
    it('应该返回dateRange虚拟字段', async () => {
      const period = await Period.create({
        name: '期次',
        title: '标题',
        startDate: new Date('2025-01-15'),
        endDate: new Date('2025-02-28')
      });

      const periodObj = period.toJSON();
      expect(periodObj.dateRange).to.exist;
      expect(periodObj.dateRange).to.include('01/15');
      expect(periodObj.dateRange).to.include('02/28');
      expect(periodObj.dateRange).to.include('至');
    });

    it('dateRange应该使用本地时间而不是UTC', async () => {
      const period = await Period.create({
        name: '期次',
        title: '标题',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      const periodObj = period.toJSON();
      expect(periodObj.dateRange).to.include('01/01');
      expect(periodObj.dateRange).to.include('01/31');
    });

    it('应该在toJSON时包含虚拟字段', async () => {
      const period = await Period.create({
        name: '期次',
        title: '标题',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      const periodObj = period.toJSON();
      expect(periodObj).to.have.property('dateRange');
    });
  });

  describe('Indexes', () => {
    it('应该在(startDate, endDate)上有索引', async () => {
      const indexes = await Period.collection.getIndexes();
      const index = Object.values(indexes).find(
        idx => idx.key?.startDate === 1 && idx.key?.endDate === 1
      );
      expect(index).to.exist;
    });

    it('应该在status字段上有索引', async () => {
      const indexes = await Period.collection.getIndexes();
      const index = Object.values(indexes).find(idx => idx.key?.status === 1);
      expect(index).to.exist;
    });

    it('应该在(isPublished, sortOrder)上有索引', async () => {
      const indexes = await Period.collection.getIndexes();
      const index = Object.values(indexes).find(
        idx => idx.key?.isPublished === 1 && idx.key?.sortOrder === 1
      );
      expect(index).to.exist;
    });
  });

  describe('Timestamps and Metadata', () => {
    it('应该自动创建createdAt和updatedAt', async () => {
      const period = await Period.create({
        name: '期次',
        title: '标题',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      expect(period.createdAt).to.exist;
      expect(period.updatedAt).to.exist;
      expect(period.createdAt).to.be.instanceof(Date);
      expect(period.updatedAt).to.be.instanceof(Date);
    });

    it('不应该包含__v字段', async () => {
      const period = await Period.create({
        name: '期次',
        title: '标题',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      const obj = period.toObject();
      expect(obj).to.not.have.property('__v');
    });
  });

  describe('Data Persistence', () => {
    it('应该保存并检索期次数据', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      const original = await Period.create({
        name: '第一期',
        title: '心流之境',
        subtitle: '在静心中发现自我',
        description: '这是一个很棒的期次',
        startDate,
        endDate,
        totalDays: 31,
        price: 99.99,
        originalPrice: 199.99,
        maxEnrollment: 100,
        status: 'ongoing',
        isPublished: true
      });

      const retrieved = await Period.findById(original._id);

      expect(retrieved.name).to.equal('第一期');
      expect(retrieved.title).to.equal('心流之境');
      expect(retrieved.subtitle).to.equal('在静心中发现自我');
      expect(retrieved.description).to.equal('这是一个很棒的期次');
      expect(retrieved.totalDays).to.equal(31);
      expect(retrieved.price).to.equal(99.99);
      expect(retrieved.originalPrice).to.equal(199.99);
      expect(retrieved.maxEnrollment).to.equal(100);
      expect(retrieved.status).to.equal('ongoing');
      expect(retrieved.isPublished).to.be.true;
    });

    it('应该更新期次数据', async () => {
      const period = await Period.create({
        name: '期次',
        title: '标题',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
        status: 'not_started'
      });

      period.status = 'ongoing';
      period.checkinCount = 50;
      period.currentEnrollment = 80;
      await period.save();

      const updated = await Period.findById(period._id);
      expect(updated.status).to.equal('ongoing');
      expect(updated.checkinCount).to.equal(50);
      expect(updated.currentEnrollment).to.equal(80);
    });

    it('应该删除期次数据', async () => {
      const period = await Period.create({
        name: '期次',
        title: '标题',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      await Period.findByIdAndDelete(period._id);
      const deleted = await Period.findById(period._id);

      expect(deleted).to.be.null;
    });

    it('应该支持按status查询', async () => {
      await Period.create({
        name: '期次1',
        title: '标题1',
        status: 'ongoing',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      await Period.create({
        name: '期次2',
        title: '标题2',
        status: 'completed',
        startDate: new Date('2024-12-01'),
        endDate: new Date('2024-12-31')
      });

      const ongoing = await Period.find({ status: 'ongoing' });
      expect(ongoing).to.have.lengthOf(1);
      expect(ongoing[0].name).to.equal('期次1');
    });

    it('应该支持按isPublished查询', async () => {
      await Period.create({
        name: '期次1',
        title: '标题1',
        isPublished: true,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      await Period.create({
        name: '期次2',
        title: '标题2',
        isPublished: false,
        startDate: new Date('2025-02-01'),
        endDate: new Date('2025-02-28')
      });

      const published = await Period.find({ isPublished: true });
      expect(published).to.have.lengthOf(1);
    });

    it('应该支持按日期范围查询', async () => {
      const startOfJan = new Date('2025-01-01');
      const endOfJan = new Date('2025-01-31');

      await Period.create({
        name: '期次1',
        title: '标题1',
        startDate: startOfJan,
        endDate: endOfJan
      });

      await Period.create({
        name: '期次2',
        title: '标题2',
        startDate: new Date('2025-02-01'),
        endDate: new Date('2025-02-28')
      });

      const janPeriods = await Period.find({
        startDate: { $gte: startOfJan },
        endDate: { $lte: endOfJan }
      });

      expect(janPeriods).to.have.lengthOf(1);
    });
  });

  describe('Edge Cases', () => {
    it('应该处理很长的name', async () => {
      const longName = 'a'.repeat(50);
      const period = await Period.create({
        name: longName,
        title: '标题',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      expect(period.name).to.have.lengthOf(50);
    });

    it('应该处理很长的title', async () => {
      const longTitle = 'a'.repeat(100);
      const period = await Period.create({
        name: '期次',
        title: longTitle,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      expect(period.title).to.have.lengthOf(100);
    });

    it('应该支持多个期次有相同的name', async () => {
      await Period.create({
        name: '期次',
        title: '标题1',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      const period2 = await Period.create({
        name: '期次',
        title: '标题2',
        startDate: new Date('2025-02-01'),
        endDate: new Date('2025-02-28')
      });

      expect(period2.name).to.equal('期次');
    });

    it('应该支持很大的enrollmentCount', async () => {
      const period = await Period.create({
        name: '期次',
        title: '标题',
        enrollmentCount: 999999,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      expect(period.enrollmentCount).to.equal(999999);
    });

    it('应该支持特殊字符在description中', async () => {
      const description = '这是描述🎉 @#$%^&*()';
      const period = await Period.create({
        name: '期次',
        title: '标题',
        description,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      expect(period.description).to.equal(description);
    });

    it('应该接受null作为coverColor', async () => {
      const period = await Period.create({
        name: '期次',
        title: '标题',
        coverColor: null,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      expect(period.coverColor).to.be.null;
    });

    it('应该接受RGB颜色作为coverColor', async () => {
      const period = await Period.create({
        name: '期次',
        title: '标题',
        coverColor: 'rgb(255, 0, 0)',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      expect(period.coverColor).to.equal('rgb(255, 0, 0)');
    });

    it('应该支持负的sortOrder', async () => {
      const period = await Period.create({
        name: '期次',
        title: '标题',
        sortOrder: -1,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      });

      expect(period.sortOrder).to.equal(-1);
    });
  });
});
