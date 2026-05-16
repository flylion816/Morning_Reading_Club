/**
 * 租户配置
 *
 * 每个租户对应一份小程序壳（独立微信 appId、独立审核），
 * 通过修改本文件 + envConfig 切换。
 *
 * 上线前必须确认本文件的 wxAppId 与 envConfig 中的 wxAppId 一致。
 */
module.exports = {
  // 显示用品牌名（用于首页标题、关于页等）
  brandName: '凡人共读',

  // 主色（如需运行时换肤可读取此值）
  primaryColor: '#4a90e2',

  // logo 路径
  logo: '/assets/icons/book.png',

  // 客服联系信息
  contactEmail: 'support@fanren.club',

  // 协议页文案中可能用到的法人主体
  legalEntity: '凡人共读 团队'
};
