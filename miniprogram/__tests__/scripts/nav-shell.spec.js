const {
  PAPER_NAV,
  ZAICHANG_NAV,
  BRAND_NAV_PAGES,
  IMMERSIVE_NAV_PAGES,
  TAB_BAR_SHELL,
  resolvePageNavBar
} = require('../../scripts/nav-shell');

const tenantNav = { title: '凡人共读', bgColor: '#4a90e2', textStyle: 'white' };
const declared = { navigationBarBackgroundColor: '#4a90e2', navigationBarTextStyle: 'white' };

describe('nav-shell', () => {
  test('constants follow the dawn shell', () => {
    expect(PAPER_NAV).toEqual({ bgColor: '#fffdf8', textStyle: 'black' });
    expect(TAB_BAR_SHELL).toEqual({ backgroundColor: '#fffdf8', borderStyle: 'white' });
    expect(BRAND_NAV_PAGES).toEqual(['pages/periods/periods']);
  });

  test('default page that declares nav color becomes paper', () => {
    expect(resolvePageNavBar('pages/ranking', declared, tenantNav)).toEqual(PAPER_NAV);
  });

  test('default page without declared nav color is left alone', () => {
    expect(resolvePageNavBar('pages/insights/insights', { navigationBarTitleText: 'x' }, tenantNav)).toBeNull();
  });

  test('brand pages use tenant nav color even if not declared', () => {
    const expected = { bgColor: '#4a90e2', textStyle: 'white' };
    expect(resolvePageNavBar('pages/periods/periods', {}, tenantNav)).toEqual(expected);
    expect(resolvePageNavBar('pages/periods/periods', declared, tenantNav)).toEqual(expected);
  });

  test('zaichang list keeps forest green', () => {
    expect(resolvePageNavBar('pages/zaichang/list/list', declared, tenantNav)).toEqual(ZAICHANG_NAV);
    expect(ZAICHANG_NAV).toEqual({ bgColor: '#2D5A3D', textStyle: 'white' });
  });

  test('zaichang detail and publish become paper', () => {
    expect(resolvePageNavBar('pages/zaichang/detail/detail', ZAICHANG_NAV_JSON(), tenantNav)).toEqual(PAPER_NAV);
    expect(resolvePageNavBar('pages/zaichang/publish/publish', ZAICHANG_NAV_JSON(), tenantNav)).toEqual(PAPER_NAV);
  });

  test('podcast player is immersive: dark nav matching the page top, white text', () => {
    const expected = { bgColor: '#22301f', textStyle: 'white' };
    expect(IMMERSIVE_NAV_PAGES['pages/podcast-player/podcast-player']).toEqual(expected);
    expect(resolvePageNavBar('pages/podcast-player/podcast-player', {}, tenantNav)).toEqual(expected);
    expect(resolvePageNavBar('pages/podcast-player/podcast-player', declared, tenantNav)).toEqual(expected);
  });

  test('custom navigation pages are never written', () => {
    expect(resolvePageNavBar('pages/checkin/checkin', { navigationStyle: 'custom', ...declared }, tenantNav)).toBeNull();
    expect(resolvePageNavBar('pages/periods/periods', { navigationStyle: 'custom' }, tenantNav)).toBeNull();
  });

  test('home page nav follows the daypart, so it is a paper page, not a brand page', () => {
    expect(resolvePageNavBar('pages/index/index', { navigationBarBackgroundColor: '#fffdf8', navigationBarTextStyle: 'black' }, tenantNav)).toEqual(PAPER_NAV);
  });
});

function ZAICHANG_NAV_JSON() {
  return { navigationBarBackgroundColor: '#2D5A3D', navigationBarTextStyle: 'white' };
}
