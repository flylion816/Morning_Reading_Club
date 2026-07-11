const currentTenant = require('../config/current-tenant');

const DEFAULT_BRAND_NAME = '晨读营';
const DEFAULT_COURSE_NAME = '《高效能人士的七个习惯》';
const DEFAULT_SLOGAN = '一个早起、读书、谈心的地方';
const DEFAULT_SHARE_TOPIC = '每日晨读';
const DEFAULT_SHARE_IMAGE = '/assets/images/share-default.jpg';

function getBrandName() {
  return String(currentTenant.brandName || currentTenant.navBar?.title || DEFAULT_BRAND_NAME).trim() || DEFAULT_BRAND_NAME;
}

function getCourseName() {
  return String(currentTenant.courseName || DEFAULT_COURSE_NAME).trim() || DEFAULT_COURSE_NAME;
}

function getBrandSlogan() {
  return String(currentTenant.slogan || DEFAULT_SLOGAN).trim() || DEFAULT_SLOGAN;
}

function getDefaultShareTitle(topic = DEFAULT_SHARE_TOPIC) {
  const safeTopic = String(topic || DEFAULT_SHARE_TOPIC).trim() || DEFAULT_SHARE_TOPIC;
  return `${getBrandName()}｜${safeTopic}`;
}

function getDefaultShareImage() {
  return String(currentTenant.shareCover || '').trim() || DEFAULT_SHARE_IMAGE;
}

function getBrandedTitle(title, separator = ' - ') {
  const safeTitle = String(title || '').trim();
  return safeTitle ? `${safeTitle}${separator}${getBrandName()}` : getBrandName();
}

module.exports = {
  DEFAULT_BRAND_NAME,
  DEFAULT_COURSE_NAME,
  DEFAULT_SLOGAN,
  DEFAULT_SHARE_TOPIC,
  DEFAULT_SHARE_IMAGE,
  getBrandName,
  getCourseName,
  getBrandSlogan,
  getDefaultShareTitle,
  getDefaultShareImage,
  getBrandedTitle
};
