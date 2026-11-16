/**
 * 富文本编辑器（editor）的高度。
 *
 * 微信的 editor 组件没有「自动增高」：高度是固定的，内容多了只能在框里滚动，
 * 框的下沿会把最后一行切成半行。这里按内容算出需要的高度，页面再把它设给 editor，
 * 让整段文字都显示出来，由页面本身滚动。
 *
 * 量法：页面里放一个看不见的 view，字号、行高、内边距、宽度都和 editor 一样，装进同样的文字，
 * 量它的高度（px），再换算成 rpx。editor 和这个 view 都在同一个 WebView 里排版，折行位置一致。
 */

// 与打卡页 .rich-editor 的 min-height 一致：内容再少也不会比这个矮
const MIN_RPX = 360;
// 只是一道安全线，防止异常数据把页面撑到离谱的高度；3000 字的上限远到不了这里
const MAX_RPX = 8000;
// 最后一行下面多留一点，光标停在最后一行时不贴着框的下沿，也吸收量出来和实际排出来的零头差别
const SLACK_RPX = 48;
// 标题（h1–h6）比正文高，纯文字量不出来，每个标题补一点
const HEADING_EXTRA_RPX = 28;

function countHeadings(html) {
  return (String(html || '').match(/<h[1-6]\b/gi) || []).length;
}

/**
 * measuredPx：看不见的那个 view 量出来的高度（px，已含上下内边距）
 * windowWidthPx：屏幕宽度（px），用来把 px 换成 rpx（750rpx = 屏幕宽度）
 * 返回 editor 该设的高度（rpx，整数）；量不出来（没有数、不是正数）就用最小高度。
 */
function fitEditorHeight(measuredPx, windowWidthPx, options = {}) {
  const { headings = 0, min = MIN_RPX, max = MAX_RPX } = options;
  const px = Number(measuredPx);
  const width = Number(windowWidthPx);
  if (!(px > 0) || !(width > 0)) return min;
  const rpx = (px * 750) / width;
  const height = Math.ceil(rpx + SLACK_RPX + Math.max(0, Number(headings) || 0) * HEADING_EXTRA_RPX);
  return Math.min(max, Math.max(min, height));
}

module.exports = { MIN_RPX, MAX_RPX, SLACK_RPX, HEADING_EXTRA_RPX, countHeadings, fitEditorHeight };
