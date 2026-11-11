// 晨光导航外壳规则：纯函数 + 常量，供 apply-tenant.js 与单测共用
const PAPER_NAV = Object.freeze({ bgColor: '#fffdf8', textStyle: 'black' });
const ZAICHANG_NAV = Object.freeze({ bgColor: '#2D5A3D', textStyle: 'white' });
const WINDOW_BACKGROUND_COLOR = '#f6f1e7';
const BACKGROUND_TEXT_STYLE = 'dark';
// Tab 栏底色现在由这里固定写入，租户配置里的 tabBar.backgroundColor 不再生效
const TAB_BAR_SHELL = Object.freeze({ backgroundColor: '#fffdf8', borderStyle: 'white' });

// 深色沉浸页：导航栏与页面顶部同色（播客页顶部为 podcast-player.wxss 里的 #22301f）
const IMMERSIVE_NAV_PAGES = Object.freeze({
  'pages/podcast-player/podcast-player': Object.freeze({ bgColor: '#22301f', textStyle: 'white' })
});

// 保留租户导航色的品牌页
const BRAND_NAV_PAGES = Object.freeze(['pages/periods/periods']);
// 「在场」列表页是子品牌门面，保留深绿；详情、发布页按内容页处理
const ZAICHANG_BRAND_PAGES = Object.freeze(['pages/zaichang/list/list']);

/**
 * 返回页面应写入的导航字段 { bgColor, textStyle }；null 表示不写。
 * @param {string} pagePath 如 pages/index/index
 * @param {object} pageJson 页面现有 json
 * @param {{bgColor: string, textStyle: string}} tenantNavBar 租户导航配置
 */
function resolvePageNavBar(pagePath, pageJson, tenantNavBar) {
  const json = pageJson || {};
  if (json.navigationStyle === 'custom') return null;
  if (IMMERSIVE_NAV_PAGES[pagePath]) return { ...IMMERSIVE_NAV_PAGES[pagePath] };
  if (BRAND_NAV_PAGES.includes(pagePath)) {
    return { bgColor: tenantNavBar.bgColor, textStyle: tenantNavBar.textStyle };
  }
  if (ZAICHANG_BRAND_PAGES.includes(pagePath)) {
    return { ...ZAICHANG_NAV };
  }
  if (!json.navigationBarBackgroundColor && !json.navigationBarTextStyle) return null;
  return { ...PAPER_NAV };
}

module.exports = {
  PAPER_NAV,
  ZAICHANG_NAV,
  BRAND_NAV_PAGES,
  IMMERSIVE_NAV_PAGES,
  ZAICHANG_BRAND_PAGES,
  WINDOW_BACKGROUND_COLOR,
  BACKGROUND_TEXT_STYLE,
  TAB_BAR_SHELL,
  resolvePageNavBar
};
