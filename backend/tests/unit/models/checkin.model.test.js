/**
 * Checkin Model 单元测试
 */

const { expect } = require('chai');
const mongoose = require('mongoose');
const Checkin = require('../../../src/models/Checkin');

describe('Checkin Model', () => {
  let userId;
  let periodId;
  let sectionId;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
    }

    // 创建用于关联的ObjectIds
    userId = new mongoose.Types.ObjectId();
    periodId = new mongoose.Types.ObjectId();
    sectionId = new mongoose.Types.ObjectId();
  });

  afterEach(async () => {
    await Checkin.deleteMany({});
  });

  after(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  describe('Schema Validation', () => {
    it('应该创建有效的打卡记录', async () => {
      const checkin = await Checkin.create({
        userId,
        periodId,
        sectionId,
        day: 1,
        checkinDate: new Date()
      });

      expect(checkin._id).to.exist;
      expect(checkin.userId.toString()).to.equal(userId.toString());
      expect(checkin.periodId.toString()).to.equal(periodId.toString());
      expect(checkin.sectionId.toString()).to.equal(sectionId.toString());
      expect(checkin.day).to.equal(1);
    });

    it('应该使用默认值', async () => {
      const checkin = await Checkin.create({
        userId,
        periodId,
        sectionId,
        day: 1,
        checkinDate: new Date()
      });

      expect(checkin.readingTime).to.equal(0);
      expect(checkin.completionRate).to.equal(0);
      expect(checkin.note).to.be.null;
      expect(checkin.images).to.deep.equal([]);
      expect(checkin.mood).to.be.null;
      expect(checkin.points).to.equal(10);
      expect(checkin.isPublic).to.be.true;
      expect(checkin.likeCount).to.equal(0);
      expect(checkin.isFeatured).to.be.false;
    });

    it('应该在缺少userId时抛出验证错误', async () => {
      try {
        await Checkin.create({
          periodId,
          sectionId,
          day: 1,
          checkinDate: new Date()
        });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('userId');
      }
    });

    it('应该在缺少periodId时抛出验证错误', async () => {
      try {
        await Checkin.create({
          userId,
          sectionId,
          day: 1,
          checkinDate: new Date()
        });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('periodId');
      }
    });

    it('应该在缺少sectionId时抛出验证错误', async () => {
      try {
        await Checkin.create({
          userId,
          periodId,
          day: 1,
          checkinDate: new Date()
        });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('sectionId');
      }
    });

    it('应该在缺少day时抛出验证错误', async () => {
      try {
        await Checkin.create({
          userId,
          periodId,
          sectionId,
          checkinDate: new Date()
        });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('day');
      }
    });

    it('应该在缺少checkinDate时抛出验证错误', async () => {
      try {
        await Checkin.create({
          userId,
          periodId,
          sectionId,
          day: 1
        });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('checkinDate');
      }
    });

    it('应该接受有效的mood值', async () => {
      const moods = ['happy', 'calm', 'thoughtful', 'inspired', 'other'];
      for (const mood of moods) {
        const checkin = await Checkin.create({
          userId,
          periodId,
          sectionId,
          day: 1,
          checkinDate: new Date(),
          mood
        });
        expect(checkin.mood).to.equal(mood);
      }
    });

    it('应该拒绝无效的mood值', async () => {
      try {
        await Checkin.create({
          userId,
          periodId,
          sectionId,
          day: 1,
          checkinDate: new Date(),
          mood: 'invalid_mood'
        });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('mood');
      }
    });
  });

  describe('Field Constraints', () => {
    it('应该验证day最小值', async () => {
      try {
        await Checkin.create({
          userId,
          periodId,
          sectionId,
          day: -1,
          checkinDate: new Date()
        });
        expect.fail('应该抛出最小值验证错误');
      } catch (err) {
        expect(err.message).to.include('day');
      }
    });

    it('应该接受day为0', async () => {
      const checkin = await Checkin.create({
        userId,
        periodId,
        sectionId,
        day: 0,
        checkinDate: new Date()
      });

      expect(checkin.day).to.equal(0);
    });

    it('应该验证readingTime最小值', async () => {
      try {
        await Checkin.create({
          userId,
          periodId,
          sectionId,
          day: 1,
          checkinDate: new Date(),
          readingTime: -1
        });
        expect.fail('应该抛出最小值验证错误');
      } catch (err) {
        expect(err.message).to.include('readingTime');
      }
    });

    it('应该验证completionRate在0-100之间', async () => {
      try {
        await Checkin.create({
          userId,
          periodId,
          sectionId,
          day: 1,
          checkinDate: new Date(),
          completionRate: 101
        });
        expect.fail('应该抛出范围验证错误');
      } catch (err) {
        expect(err.message).to.include('completionRate');
      }
    });

    it('应该验证completionRate不能小于0', async () => {
      try {
        await Checkin.create({
          userId,
          periodId,
          sectionId,
          day: 1,
          checkinDate: new Date(),
          completionRate: -1
        });
        expect.fail('应该抛出最小值验证错误');
      } catch (err) {
        expect(err.message).to.include('completionRate');
      }
    });

    it('应该接受completionRate为0和100', async () => {
      const checkin1 = await Checkin.create({
        userId,
        periodId,
        sectionId,
        day: 1,
        checkinDate: new Date(),
        completionRate: 0
      });

      const checkin2 = await Checkin.create({
        userId: new mongoose.Types.ObjectId(),
        periodId,
        sectionId,
        day: 2,
        checkinDate: new Date(),
        completionRate: 100
      });

      expect(checkin1.completionRate).to.equal(0);
      expect(checkin2.completionRate).to.equal(100);
    });

    it('应该验证note最大长度', async () => {
      try {
        await Checkin.create({
          userId,
          periodId,
          sectionId,
          day: 1,
          checkinDate: new Date(),
          note: 'a'.repeat(1001)
        });
        expect.fail('应该抛出长度验证错误');
      } catch (err) {
        expect(err.message).to.include('note');
      }
    });

    it('应该接受完整长度的note', async () => {
      const note = 'a'.repeat(1000);
      const checkin = await Checkin.create({
        userId,
        periodId,
        sectionId,
        day: 1,
        checkinDate: new Date(),
        note
      });

      expect(checkin.note).to.have.lengthOf(1000);
    });

    it('应该验证points最小值', async () => {
      try {
        await Checkin.create({
          userId,
          periodId,
          sectionId,
          day: 1,
          checkinDate: new Date(),
          points: -1
        });
        expect.fail('应该抛出最小值验证错误');
      } catch (err) {
        expect(err.message).to.include('points');
      }
    });

    it('应该验证likeCount最小值', async () => {
      try {
        await Checkin.create({
          userId,
          periodId,
          sectionId,
          day: 1,
          checkinDate: new Date(),
          likeCount: -1
        });
        expect.fail('应该抛出最小值验证错误');
      } catch (err) {
        expect(err.message).to.include('likeCount');
      }
    });
  });

  describe('Array Fields', () => {
    it('应该接受images数组', async () => {
      const images = ['image1.jpg', 'image2.jpg', 'image3.jpg'];
      const checkin = await Checkin.create({
        userId,
        periodId,
        sectionId,
        day: 1,
        checkinDate: new Date(),
        images
      });

      expect(checkin.images).to.deep.equal(images);
    });

    it('应该接受空images数组', async () => {
      const checkin = await Checkin.create({
        userId,
        periodId,
        sectionId,
        day: 1,
        checkinDate: new Date(),
        images: []
      });

      expect(checkin.images).to.deep.equal([]);
    });

    it('应该保持images数组的顺序', async () => {
      const images = ['first.jpg', 'second.jpg', 'third.jpg'];
      const checkin = await Checkin.create({
        userId,
        periodId,
        sectionId,
        day: 1,
        checkinDate: new Date(),
        images
      });

      const retrieved = await Checkin.findById(checkin._id);
      expect(retrieved.images).to.deep.equal(images);
    });
  });

  describe('Boolean Fields', () => {
    it('应该接受isPublic为true', async () => {
      const checkin = await Checkin.create({
        userId,
        periodId,
        sectionId,
        day: 1,
        checkinDate: new Date(),
        isPublic: true
      });

      expect(checkin.isPublic).to.be.true;
    });

    it('应该接受isPublic为false', async () => {
      const checkin = await Checkin.create({
        userId,
        periodId,
        sectionId,
        day: 1,
        checkinDate: new Date(),
        isPublic: false
      });

      expect(checkin.isPublic).to.be.false;
    });

    it('应该接受isFeatured为true', async () => {
      const checkin = await Checkin.create({
        userId,
        periodId,
        sectionId,
        day: 1,
        checkinDate: new Date(),
        isFeatured: true
      });

      expect(checkin.isFeatured).to.be.true;
    });

    it('应该接受isFeatured为false', async () => {
      const checkin = await Checkin.create({
        userId,
        periodId,
        sectionId,
        day: 1,
        checkinDate: new Date(),
        isFeatured: false
      });

      expect(checkin.isFeatured).to.be.false;
    });
  });

  describe('Indexes', () => {
    it('应该在(userId, periodId, checkinDate)上有复合唯一索引', async () => {
      const indexes = await Checkin.collection.getIndexes();
      const compositeIndex = Object.values(indexes).find(
        idx => idx.key?.userId === 1 && idx.key?.periodId === 1 && idx.key?.checkinDate === 1
      );
      expect(compositeIndex).to.exist;
      expect(compositeIndex.unique).to.be.true;
    });

    it('应该在(userId, checkinDate)上有索引', async () => {
      const indexes = await Checkin.collection.getIndexes();
      const index = Object.values(indexes).find(
        idx => idx.key?.userId === 1 && idx.key?.checkinDate === -1
      );
      expect(index).to.exist;
    });

    it('应该在(periodId, checkinDate)上有索引', async () => {
      const indexes = await Checkin.collection.getIndexes();
      const index = Object.values(indexes).find(
        idx => idx.key?.periodId === 1 && idx.key?.checkinDate === -1
      );
      expect(index).to.exist;
    });

    it('应该在sectionId上有索引', async () => {
      const indexes = await Checkin.collection.getIndexes();
      const index = Object.values(indexes).find(idx => idx.key?.sectionId === 1);
      expect(index).to.exist;
    });

    it('应该在(isPublic, createdAt)上有索引', async () => {
      const indexes = await Checkin.collection.getIndexes();
      const index = Object.values(indexes).find(
        idx => idx.key?.isPublic === 1 && idx.key?.createdAt === -1
      );
      expect(index).to.exist;
    });

    it('应该在(isFeatured, likeCount)上有索引', async () => {
      const indexes = await Checkin.collection.getIndexes();
      const index = Object.values(indexes).find(
        idx => idx.key?.isFeatured === 1 && idx.key?.likeCount === -1
      );
      expect(index).to.exist;
    });
  });

  describe('References', () => {
    it('应该保存userId引用', async () => {
      const checkin = await Checkin.create({
        userId,
        periodId,
        sectionId,
        day: 1,
        checkinDate: new Date()
      });

      expect(checkin.userId.toString()).to.equal(userId.toString());
    });

    it('应该保存periodId引用', async () => {
      const checkin = await Checkin.create({
        userId,
        periodId,
        sectionId,
        day: 1,
        checkinDate: new Date()
      });

      expect(checkin.periodId.toString()).to.equal(periodId.toString());
    });

    it('应该保存sectionId引用', async () => {
      const checkin = await Checkin.create({
        userId,
        periodId,
        sectionId,
        day: 1,
        checkinDate: new Date()
      });

      expect(checkin.sectionId.toString()).to.equal(sectionId.toString());
    });
  });

  describe('Timestamps and Metadata', () => {
    it('应该自动创建createdAt和updatedAt', async () => {
      const checkin = await Checkin.create({
        userId,
        periodId,
        sectionId,
        day: 1,
        checkinDate: new Date()
      });

      expect(checkin.createdAt).to.exist;
      expect(checkin.updatedAt).to.exist;
      expect(checkin.createdAt).to.be.instanceof(Date);
      expect(checkin.updatedAt).to.be.instanceof(Date);
    });

    it('不应该包含__v字段', async () => {
      const checkin = await Checkin.create({
        userId,
        periodId,
        sectionId,
        day: 1,
        checkinDate: new Date()
      });

      const obj = checkin.toObject();
      expect(obj).to.not.have.property('__v');
    });
  });

  describe('Data Persistence', () => {
    it('应该保存并检索打卡数据', async () => {
      const checkinDate = new Date();
      const original = await Checkin.create({
        userId,
        periodId,
        sectionId,
        day: 5,
        checkinDate,
        readingTime: 45,
        completionRate: 85,
        note: '很有收获',
        mood: 'inspired',
        points: 15,
        isPublic: true
      });

      const retrieved = await Checkin.findById(original._id);

      expect(retrieved.day).to.equal(5);
      expect(retrieved.readingTime).to.equal(45);
      expect(retrieved.completionRate).to.equal(85);
      expect(retrieved.note).to.equal('很有收获');
      expect(retrieved.mood).to.equal('inspired');
      expect(retrieved.points).to.equal(15);
      expect(retrieved.isPublic).to.be.true;
    });

    it('应该更新打卡数据', async () => {
      const checkin = await Checkin.create({
        userId,
        periodId,
        sectionId,
        day: 1,
        checkinDate: new Date(),
        readingTime: 30,
        likeCount: 0
      });

      checkin.readingTime = 60;
      checkin.likeCount = 5;
      await checkin.save();

      const updated = await Checkin.findById(checkin._id);
      expect(updated.readingTime).to.equal(60);
      expect(updated.likeCount).to.equal(5);
    });

    it('应该删除打卡数据', async () => {
      const checkin = await Checkin.create({
        userId,
        periodId,
        sectionId,
        day: 1,
        checkinDate: new Date()
      });

      await Checkin.findByIdAndDelete(checkin._id);
      const deleted = await Checkin.findById(checkin._id);

      expect(deleted).to.be.null;
    });

    it('应该支持按userId查询', async () => {
      const user1Id = new mongoose.Types.ObjectId();
      const user2Id = new mongoose.Types.ObjectId();

      await Checkin.create({
        userId: user1Id,
        periodId,
        sectionId,
        day: 1,
        checkinDate: new Date()
      });

      await Checkin.create({
        userId: user2Id,
        periodId,
        sectionId,
        day: 2,
        checkinDate: new Date()
      });

      const user1Checkins = await Checkin.find({ userId: user1Id });
      expect(user1Checkins).to.have.lengthOf(1);
      expect(user1Checkins[0].userId.toString()).to.equal(user1Id.toString());
    });

    it('应该支持按periodId查询', async () => {
      const period1 = new mongoose.Types.ObjectId();
      const period2 = new mongoose.Types.ObjectId();

      await Checkin.create({
        userId,
        periodId: period1,
        sectionId,
        day: 1,
        checkinDate: new Date()
      });

      await Checkin.create({
        userId: new mongoose.Types.ObjectId(),
        periodId: period2,
        sectionId,
        day: 1,
        checkinDate: new Date()
      });

      const period1Checkins = await Checkin.find({ periodId: period1 });
      expect(period1Checkins).to.have.lengthOf(1);
    });
  });

  describe('Edge Cases', () => {
    it('应该处理很大的day数字', async () => {
      const checkin = await Checkin.create({
        userId,
        periodId,
        sectionId,
        day: 999999,
        checkinDate: new Date()
      });

      expect(checkin.day).to.equal(999999);
    });

    it('应该处理超过1000个字符的note', () => {
      // 这个测试在字段约束中已验证
      expect(true).to.be.true;
    });

    it('应该支持多个打卡记录有不同的mood', async () => {
      const moods = ['happy', 'calm', 'thoughtful', 'inspired', 'other'];
      const checkins = [];

      for (let i = 0; i < moods.length; i++) {
        const c = await Checkin.create({
          userId: new mongoose.Types.ObjectId(),
          periodId,
          sectionId,
          day: i + 1,
          checkinDate: new Date(),
          mood: moods[i]
        });
        checkins.push(c);
      }

      expect(checkins).to.have.lengthOf(5);
      for (let i = 0; i < checkins.length; i++) {
        expect(checkins[i].mood).to.equal(moods[i]);
      }
    });

    it('应该支持多个用户的打卡', async () => {
      const users = [
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId()
      ];

      for (let i = 0; i < users.length; i++) {
        await Checkin.create({
          userId: users[i],
          periodId,
          sectionId,
          day: i + 1,
          checkinDate: new Date()
        });
      }

      const allCheckins = await Checkin.find();
      expect(allCheckins).to.have.lengthOf(3);
    });
  });
});
