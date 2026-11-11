const { expect } = require('chai');
const { toDayKey, computeDayMetrics } = require('../../../src/utils/checkin-day-metrics');

describe('checkin-day-metrics', () => {
  describe('toDayKey', () => {
    it('东八区 23:59 与次日 00:01 分属两天', () => {
      expect(toDayKey(new Date('2026-11-04T23:59:00+08:00'))).to.equal('2026-11-04');
      expect(toDayKey(new Date('2026-11-05T00:01:00+08:00'))).to.equal('2026-11-05');
    });
    it('UTC 16:30 落在东八区次日', () => {
      expect(toDayKey(new Date('2026-11-04T16:30:00Z'))).to.equal('2026-11-05');
      expect(toDayKey(new Date('2026-11-04T15:59:00Z'))).to.equal('2026-11-04');
    });
    it('无效时间返回 null', () => {
      expect(toDayKey('abc')).to.equal(null);
    });
  });

  describe('computeDayMetrics', () => {
    const now = new Date('2026-11-10T12:00:00+08:00');

    it('空数组全为 0', () => {
      expect(computeDayMetrics([], now)).to.deep.equal({
        dayKeys: [],
        totalDays: 0,
        currentStreak: 0,
        maxStreak: 0
      });
    });
    it('同一天多次打卡只算一天', () => {
      const r = computeDayMetrics(
        [
          new Date('2026-11-10T08:00:00+08:00'),
          new Date('2026-11-10T09:00:00+08:00'),
          new Date('2026-11-10T21:00:00+08:00')
        ],
        now
      );
      expect(r.totalDays).to.equal(1);
      expect(r.currentStreak).to.equal(1);
      expect(r.maxStreak).to.equal(1);
    });
    it('跨零点分属两天并连续', () => {
      const r = computeDayMetrics(
        [new Date('2026-11-09T23:59:00+08:00'), new Date('2026-11-10T00:01:00+08:00')],
        now
      );
      expect(r.dayKeys).to.deep.equal(['2026-11-09', '2026-11-10']);
      expect(r.currentStreak).to.equal(2);
    });
    it('UTC 时间落在东八区次日', () => {
      const r = computeDayMetrics(
        [new Date('2026-11-09T16:30:00Z')],
        new Date('2026-11-10T04:00:00Z')
      );
      expect(r.dayKeys).to.deep.equal(['2026-11-10']);
      expect(r.currentStreak).to.equal(1);
    });
    it('今天未打卡但昨天已打卡，连续不断', () => {
      const r = computeDayMetrics(
        [
          new Date('2026-11-07T10:00:00+08:00'),
          new Date('2026-11-08T10:00:00+08:00'),
          new Date('2026-11-09T10:00:00+08:00')
        ],
        now
      );
      expect(r.currentStreak).to.equal(3);
    });
    it('断卡后当前连续归零，最长连续保留；输入乱序也可', () => {
      const r = computeDayMetrics(
        [
          new Date('2026-11-03T10:00:00+08:00'),
          new Date('2026-11-01T10:00:00+08:00'),
          new Date('2026-11-02T10:00:00+08:00'),
          new Date('2026-11-07T10:00:00+08:00')
        ],
        now
      );
      expect(r.currentStreak).to.equal(0);
      expect(r.maxStreak).to.equal(3);
      expect(r.totalDays).to.equal(4);
      expect(r.dayKeys).to.deep.equal(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-07']);
    });
    it('跨月连续', () => {
      const r = computeDayMetrics(
        [new Date('2026-10-31T10:00:00+08:00'), new Date('2026-11-01T10:00:00+08:00')],
        new Date('2026-11-01T12:00:00+08:00')
      );
      expect(r.currentStreak).to.equal(2);
    });
  });
});
