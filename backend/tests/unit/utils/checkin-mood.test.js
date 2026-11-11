const { expect } = require('chai');
const mood = require('../../../src/utils/checkin-mood');

describe('checkin-mood', () => {
  it('枚举包含 low，不含非法值', () => {
    expect(mood.CHECKIN_MOODS).to.deep.equal(['happy', 'calm', 'thoughtful', 'inspired', 'low', 'other']);
    expect(mood.isValidMood('low')).to.be.true;
    expect(mood.isValidMood('😊')).to.be.false;
  });

  it('早于 MOOD_VALID_SINCE 的心情视为未记录', () => {
    expect(mood.readTrustedMood({ mood: 'happy', checkinDate: '2026-11-10T23:59:00+08:00' })).to.equal(null);
    expect(mood.readTrustedMood({ mood: 'happy', checkinDate: '2026-11-11T00:00:00+08:00' })).to.equal('happy');
    expect(mood.readTrustedMood({ checkinDate: '2026-12-01T00:00:00+08:00' })).to.equal(null);
  });

  it('withTrustedMood 不修改入参', () => {
    const src = { mood: 'happy', checkinDate: '2026-01-01T00:00:00Z' };
    expect(mood.withTrustedMood(src).mood).to.equal(null);
    expect(src.mood).to.equal('happy');
  });
});
