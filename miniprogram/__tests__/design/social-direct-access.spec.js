const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const SOCIAL_PAGES = [
  'pages/checkin/checkin',
  'pages/insights/insights',
  'pages/insight-requests/insight-requests',
  'pages/insight-detail/insight-detail',
  'pages/insight-edit/insight-edit',
  'pages/checkin-records/checkin-records',
  'pages/profile-others/profile-others',
  'pages/ranking/ranking',
  'pages/members/members',
  'pages/zaichang/list/list',
  'pages/zaichang/detail/detail',
  'pages/zaichang/publish/publish',
  'pages/activities/activities',
  'pages/community-activity-detail/community-activity-detail',
  'pages/my-community-activities/my-community-activities',
  'pages/share/share'
];

describe('social direct access protection', () => {
  test.each(SOCIAL_PAGES)('%s guards before loading or rendering social content', page => {
    const script = read(`miniprogram/${page}.js`);
    const markup = read(`miniprogram/${page}.wxml`);

    expect(script).toContain('guardSocialPage(this)');
    expect(script).toContain('socialAccessGranted: false');
    expect(markup).toContain('socialAccessGranted');
  });

  test('guard redirects to the home tab rather than showing a payment-restriction toast', () => {
    const guard = read('miniprogram/utils/social-access.js');
    const zaichang = read('miniprogram/pages/zaichang/list/list.js');

    expect(guard).toContain("wx.switchTab({\n    url: HOME_URL");
    expect(guard).not.toContain('wx.showToast');
    expect(zaichang.indexOf('guardSocialPage(this)'))
      .toBeLessThan(zaichang.indexOf('.getUserEnrollments'));
  });
});
