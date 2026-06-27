// 超人读书会 —— 第二租户模板（待填入真实值）
module.exports = {
  slug: 'chaoren',
  brandName: '超人读书会',

  // —— 与 appId 强绑定（构建期固化）——
  wxAppId: 'wxTODO_REPLACE_WITH_REAL_APPID',
  cloudEnv: null,
  wechatPayMchId: null,

  // 订阅消息模板 ID（需在超人读书会公众平台申请后填入）
  subscribeTemplates: {
    enrollment_result:         '',
    payment_result:            '',
    comment_received:          '',
    like_received:             '',
    danmaku_received:          '',
    insight_liked:             '',
    insight_request_created:   '',
    insight_request_approved:  '',
    next_day_study_reminder:   '',
    insight_created:           '',
    podcast_published:         '',
    activity_reminder:         ''
  },

  // —— 视觉身份 ——
  primaryColor: '#e84118',
  logo: '/assets/tenants/chaoren/logo.png',
  shareCover: '/assets/tenants/chaoren/share-cover.jpg',
  navBar: {
    title: '超人读书会',
    bgColor: '#e84118',
    textStyle: 'white'
  },
  tabBar: {
    color: '#999999',
    selectedColor: '#e84118',
    backgroundColor: '#ffffff',
    iconsDir: '/assets/tenants/chaoren'
  },

  // —— 文案/主体 ——
  legalEntity: '超人读书会 团队',
  contactEmail: 'support@chaoren.club',

  // 为 null 时由 env.js 按环境给默认值
  apiBaseUrl: null
};
