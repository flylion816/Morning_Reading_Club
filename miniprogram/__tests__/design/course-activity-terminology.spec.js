const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('course and activity terminology', () => {
  test('admin adapts lesson numbering to the period day convention', () => {
    const source = read('admin/src/views/ContentManagementView.vue');

    expect(source).toContain('label="第几课"');
    expect(source).toContain('v-model="lessonNumber"');
    expect(source).toContain(':min="1"');
    expect(source).toContain('const lessonNumberingBase = computed');
    expect(source).toContain('days.includes(0) || days.length === 0 ? 0 : 1');
    expect(source).toContain('lessonNumberingBase.value === 0 ? day + 1 : day');
    expect(source).toContain('lessonNumberingBase.value === 0 ? next - 1 : next');
  });

  test('home displays a padded lesson label instead of Day numbering', () => {
    const script = read('miniprogram/pages/index/index.js');
    const markup = read('miniprogram/pages/index/index.wxml');

    expect(script).toContain('getLessonNumberingBase');
    expect(script).toContain('formatLessonLabel(taskRes.day, lessonNumberingBase)');
    expect(markup).toContain('{{todaySection.dayDisplay}}');
    expect(markup).not.toContain('Day {{todaySection.dayDisplay}}');
  });

  test('generic activity labels use 活动局', () => {
    const home = read('miniprogram/pages/index/index.wxml');
    const activities = read('miniprogram/pages/activities/activities.wxml');
    const popup = read('miniprogram/components/activity-popup/activity-popup.js');

    expect(home).toContain("'活动局'");
    expect(activities).toContain("'活动局'");
    expect(popup).toContain("other: '活动局'");
    expect(popup).not.toContain("other: '活动'");
  });
});
