/**
 * Section Model 单元测试
 */

const { expect } = require('chai');
const mongoose = require('mongoose');
const Section = require('../../../src/models/Section');

describe('Section Model', () => {
  let periodId;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
    }
    periodId = new mongoose.Types.ObjectId();
  });

  afterEach(async () => {
    await Section.deleteMany({});
  });

  after(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  describe('Schema Validation', () => {
    it('应该创建有效的课节', async () => {
      const section = await Section.create({
        periodId,
        day: 1,
        title: '第一课',
        content: '课程内容详情'
      });

      expect(section._id).to.exist;
      expect(section.periodId.toString()).to.equal(periodId.toString());
      expect(section.day).to.equal(1);
      expect(section.title).to.equal('第一课');
      expect(section.content).to.equal('课程内容详情');
    });

    it('应该使用默认值', async () => {
      const section = await Section.create({
        periodId,
        day: 1,
        title: '课节',
        content: '内容'
      });

      expect(section.subtitle).to.be.null;
      expect(section.icon).to.equal('📖');
      expect(section.meditation).to.be.null;
      expect(section.question).to.be.null;
      expect(section.reflection).to.be.null;
      expect(section.action).to.be.null;
      expect(section.learn).to.be.null;
      expect(section.extract).to.be.null;
      expect(section.say).to.be.null;
      expect(section.audioUrl).to.be.null;
      expect(section.videoCover).to.be.null;
      expect(section.duration).to.be.null;
      expect(section.sortOrder).to.equal(0);
      expect(section.isPublished).to.be.true;
      expect(section.checkinCount).to.equal(0);
    });

    it('应该在缺少periodId时抛出验证错误', async () => {
      try {
        await Section.create({
          day: 1,
          title: '课节',
          content: '内容'
        });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('periodId');
      }
    });

    it('应该在缺少day时抛出验证错误', async () => {
      try {
        await Section.create({
          periodId,
          title: '课节',
          content: '内容'
        });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('day');
      }
    });

    it('应该在缺少title时抛出验证错误', async () => {
      try {
        await Section.create({
          periodId,
          day: 1,
          content: '内容'
        });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('title');
      }
    });

    it('应该接受缺少content（content非必需）', async () => {
      const section = await Section.create({
        periodId,
        day: 1,
        title: '课节'
      });

      expect(section._id).to.exist;
      expect(section.content).to.be.null;
    });
  });

  describe('Field Constraints', () => {
    it('应该验证day最小值', async () => {
      try {
        await Section.create({
          periodId,
          day: -1,
          title: '课节',
          content: '内容'
        });
        expect.fail('应该抛出最小值验证错误');
      } catch (err) {
        expect(err.message).to.include('day');
      }
    });

    it('应该接受day为0', async () => {
      const section = await Section.create({
        periodId,
        day: 0,
        title: '课节',
        content: '内容'
      });

      expect(section.day).to.equal(0);
    });

    it('应该验证title最大长度', async () => {
      try {
        await Section.create({
          periodId,
          day: 1,
          title: 'a'.repeat(101),
          content: '内容'
        });
        expect.fail('应该抛出长度验证错误');
      } catch (err) {
        expect(err.message).to.include('title');
      }
    });

    it('应该接受title最大长度', async () => {
      const title = 'a'.repeat(100);
      const section = await Section.create({
        periodId,
        day: 1,
        title,
        content: '内容'
      });

      expect(section.title).to.have.lengthOf(100);
    });

    it('应该验证subtitle最大长度', async () => {
      try {
        await Section.create({
          periodId,
          day: 1,
          title: '课节',
          subtitle: 'a'.repeat(201),
          content: '内容'
        });
        expect.fail('应该抛出长度验证错误');
      } catch (err) {
        expect(err.message).to.include('subtitle');
      }
    });

    it('应该验证icon最大长度', async () => {
      try {
        await Section.create({
          periodId,
          day: 1,
          title: '课节',
          icon: 'a'.repeat(11),
          content: '内容'
        });
        expect.fail('应该抛出长度验证错误');
      } catch (err) {
        expect(err.message).to.include('icon');
      }
    });

    it('应该验证meditation最大长度', async () => {
      try {
        await Section.create({
          periodId,
          day: 1,
          title: '课节',
          meditation: 'a'.repeat(501),
          content: '内容'
        });
        expect.fail('应该抛出长度验证错误');
      } catch (err) {
        expect(err.message).to.include('meditation');
      }
    });

    it('应该验证question最大长度', async () => {
      try {
        await Section.create({
          periodId,
          day: 1,
          title: '课节',
          question: 'a'.repeat(201),
          content: '内容'
        });
        expect.fail('应该抛出长度验证错误');
      } catch (err) {
        expect(err.message).to.include('question');
      }
    });

    it('应该验证reflection最大长度', async () => {
      try {
        await Section.create({
          periodId,
          day: 1,
          title: '课节',
          reflection: 'a'.repeat(501),
          content: '内容'
        });
        expect.fail('应该抛出长度验证错误');
      } catch (err) {
        expect(err.message).to.include('reflection');
      }
    });

    it('应该验证action最大长度', async () => {
      try {
        await Section.create({
          periodId,
          day: 1,
          title: '课节',
          action: 'a'.repeat(501),
          content: '内容'
        });
        expect.fail('应该抛出长度验证错误');
      } catch (err) {
        expect(err.message).to.include('action');
      }
    });

    it('应该验证duration最小值', async () => {
      try {
        await Section.create({
          periodId,
          day: 1,
          title: '课节',
          duration: -1,
          content: '内容'
        });
        expect.fail('应该抛出最小值验证错误');
      } catch (err) {
        expect(err.message).to.include('duration');
      }
    });

    it('应该接受duration为0', async () => {
      const section = await Section.create({
        periodId,
        day: 1,
        title: '课节',
        duration: 0,
        content: '内容'
      });

      expect(section.duration).to.equal(0);
    });

    it('应该验证checkinCount最小值', async () => {
      try {
        await Section.create({
          periodId,
          day: 1,
          title: '课节',
          checkinCount: -1,
          content: '内容'
        });
        expect.fail('应该抛出最小值验证错误');
      } catch (err) {
        expect(err.message).to.include('checkinCount');
      }
    });
  });

  describe('Unique Constraints', () => {
    it('应该在同一期次中同一天只能有一个课节', async () => {
      await Section.create({
        periodId,
        day: 1,
        title: '第一课',
        content: '内容1'
      });

      try {
        await Section.create({
          periodId,
          day: 1,
          title: '第一课副本',
          content: '内容2'
        });
        expect.fail('应该抛出唯一性错误');
      } catch (err) {
        expect(err.message).to.include('unique');
      }
    });

    it('不同期次可以有相同的day', async () => {
      const period1 = new mongoose.Types.ObjectId();
      const period2 = new mongoose.Types.ObjectId();

      const section1 = await Section.create({
        periodId: period1,
        day: 1,
        title: '期次1课节1',
        content: '内容1'
      });

      const section2 = await Section.create({
        periodId: period2,
        day: 1,
        title: '期次2课节1',
        content: '内容2'
      });

      expect(section1.day).to.equal(1);
      expect(section2.day).to.equal(1);
    });
  });

  describe('Boolean Fields', () => {
    it('应该接受isPublished为true', async () => {
      const section = await Section.create({
        periodId,
        day: 1,
        title: '课节',
        isPublished: true,
        content: '内容'
      });

      expect(section.isPublished).to.be.true;
    });

    it('应该接受isPublished为false', async () => {
      const section = await Section.create({
        periodId,
        day: 1,
        title: '课节',
        isPublished: false,
        content: '内容'
      });

      expect(section.isPublished).to.be.false;
    });
  });

  describe('Indexes', () => {
    it('应该在(periodId, day)上有唯一索引', async () => {
      const indexes = await Section.collection.getIndexes();
      const index = Object.values(indexes).find(
        idx => idx.key?.periodId === 1 && idx.key?.day === 1
      );
      expect(index).to.exist;
      expect(index.unique).to.be.true;
    });

    it('应该在(periodId, sortOrder)上有索引', async () => {
      const indexes = await Section.collection.getIndexes();
      const index = Object.values(indexes).find(
        idx => idx.key?.periodId === 1 && idx.key?.sortOrder === 1
      );
      expect(index).to.exist;
    });

    it('应该在isPublished字段上有索引', async () => {
      const indexes = await Section.collection.getIndexes();
      const index = Object.values(indexes).find(idx => idx.key?.isPublished === 1);
      expect(index).to.exist;
    });
  });

  describe('References', () => {
    it('应该保存periodId引用', async () => {
      const section = await Section.create({
        periodId,
        day: 1,
        title: '课节',
        content: '内容'
      });

      expect(section.periodId.toString()).to.equal(periodId.toString());
    });
  });

  describe('Timestamps and Metadata', () => {
    it('应该自动创建createdAt和updatedAt', async () => {
      const section = await Section.create({
        periodId,
        day: 1,
        title: '课节',
        content: '内容'
      });

      expect(section.createdAt).to.exist;
      expect(section.updatedAt).to.exist;
      expect(section.createdAt).to.be.instanceof(Date);
      expect(section.updatedAt).to.be.instanceof(Date);
    });

    it('不应该包含__v字段', async () => {
      const section = await Section.create({
        periodId,
        day: 1,
        title: '课节',
        content: '内容'
      });

      const obj = section.toObject();
      expect(obj).to.not.have.property('__v');
    });
  });

  describe('Data Persistence', () => {
    it('应该保存并检索课节数据', async () => {
      const original = await Section.create({
        periodId,
        day: 5,
        title: '第五课',
        subtitle: '深度思考',
        icon: '🤔',
        meditation: '冥想指导文本',
        question: '思考的问题',
        content: '完整的课程内容',
        reflection: '反思内容',
        action: '行动建议',
        learn: '学习点',
        extract: '提取内容',
        say: '说的话',
        audioUrl: 'https://example.com/audio.mp3',
        videoCover: 'https://example.com/video-cover.jpg',
        duration: 45,
        sortOrder: 5,
        isPublished: true
      });

      const retrieved = await Section.findById(original._id);

      expect(retrieved.day).to.equal(5);
      expect(retrieved.title).to.equal('第五课');
      expect(retrieved.subtitle).to.equal('深度思考');
      expect(retrieved.icon).to.equal('🤔');
      expect(retrieved.meditation).to.equal('冥想指导文本');
      expect(retrieved.question).to.equal('思考的问题');
      expect(retrieved.content).to.equal('完整的课程内容');
      expect(retrieved.reflection).to.equal('反思内容');
      expect(retrieved.action).to.equal('行动建议');
      expect(retrieved.learn).to.equal('学习点');
      expect(retrieved.extract).to.equal('提取内容');
      expect(retrieved.say).to.equal('说的话');
      expect(retrieved.audioUrl).to.equal('https://example.com/audio.mp3');
      expect(retrieved.videoCover).to.equal('https://example.com/video-cover.jpg');
      expect(retrieved.duration).to.equal(45);
      expect(retrieved.sortOrder).to.equal(5);
      expect(retrieved.isPublished).to.be.true;
    });

    it('应该更新课节数据', async () => {
      const section = await Section.create({
        periodId,
        day: 1,
        title: '课节',
        content: '原内容'
      });

      section.title = '新标题';
      section.content = '新内容';
      section.isPublished = true;
      section.checkinCount = 50;
      await section.save();

      const updated = await Section.findById(section._id);
      expect(updated.title).to.equal('新标题');
      expect(updated.content).to.equal('新内容');
      expect(updated.isPublished).to.be.true;
      expect(updated.checkinCount).to.equal(50);
    });

    it('应该删除课节数据', async () => {
      const section = await Section.create({
        periodId,
        day: 1,
        title: '课节',
        content: '内容'
      });

      await Section.findByIdAndDelete(section._id);
      const deleted = await Section.findById(section._id);

      expect(deleted).to.be.null;
    });

    it('应该支持按periodId查询', async () => {
      await Section.create({
        periodId,
        day: 1,
        title: '课节1',
        content: '内容1'
      });

      await Section.create({
        periodId,
        day: 2,
        title: '课节2',
        content: '内容2'
      });

      const sections = await Section.find({ periodId });
      expect(sections).to.have.lengthOf(2);
    });

    it('应该支持按isPublished查询', async () => {
      await Section.create({
        periodId,
        day: 1,
        title: '课节1',
        isPublished: true,
        content: '内容1'
      });

      await Section.create({
        periodId: new mongoose.Types.ObjectId(),
        day: 1,
        title: '课节2',
        isPublished: false,
        content: '内容2'
      });

      const published = await Section.find({ isPublished: true });
      expect(published).to.have.lengthOf(1);
    });

    it('应该支持按day排序', async () => {
      for (let i = 5; i >= 1; i--) {
        await Section.create({
          periodId,
          day: i,
          title: `课节${i}`,
          content: `内容${i}`
        });
      }

      const sections = await Section.find({ periodId }).sort({ day: 1 });
      expect(sections[0].day).to.equal(1);
      expect(sections[4].day).to.equal(5);
    });
  });

  describe('Optional Fields', () => {
    it('应该接受null值的可选字段', async () => {
      const section = await Section.create({
        periodId,
        day: 1,
        title: '课节',
        content: '内容',
        subtitle: null,
        meditation: null,
        question: null,
        reflection: null,
        action: null,
        learn: null,
        extract: null,
        say: null,
        audioUrl: null,
        videoCover: null,
        duration: null
      });

      expect(section.subtitle).to.be.null;
      expect(section.meditation).to.be.null;
      expect(section.audioUrl).to.be.null;
    });

    it('应该接受duration为null', async () => {
      const section = await Section.create({
        periodId,
        day: 1,
        title: '课节',
        content: '内容',
        duration: null
      });

      expect(section.duration).to.be.null;
    });
  });

  describe('Edge Cases', () => {
    it('应该处理很长的content', async () => {
      const longContent = 'a'.repeat(10000);
      const section = await Section.create({
        periodId,
        day: 1,
        title: '课节',
        content: longContent
      });

      expect(section.content).to.have.lengthOf(10000);
    });

    it('应该处理特殊字符在title中', async () => {
      const specialTitle = '课节🎉@#$%^&*()';
      const section = await Section.create({
        periodId,
        day: 1,
        title: specialTitle,
        content: '内容'
      });

      expect(section.title).to.equal(specialTitle);
    });

    it('应该支持很大的day数字', async () => {
      const section = await Section.create({
        periodId,
        day: 999999,
        title: '课节',
        content: '内容'
      });

      expect(section.day).to.equal(999999);
    });

    it('应该支持很大的checkinCount', async () => {
      const section = await Section.create({
        periodId,
        day: 1,
        title: '课节',
        checkinCount: 999999,
        content: '内容'
      });

      expect(section.checkinCount).to.equal(999999);
    });

    it('应该支持负的sortOrder', async () => {
      const section = await Section.create({
        periodId,
        day: 1,
        title: '课节',
        sortOrder: -5,
        content: '内容'
      });

      expect(section.sortOrder).to.equal(-5);
    });

    it('应该支持URL格式的audioUrl', async () => {
      const section = await Section.create({
        periodId,
        day: 1,
        title: '课节',
        audioUrl: 'https://example.com/audio/chapter-1.mp3',
        content: '内容'
      });

      expect(section.audioUrl).to.include('https://');
    });
  });
});
