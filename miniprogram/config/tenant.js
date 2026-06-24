// 兼容垫片：原 tenant.js 已迁移为多租户配置体系
// 直接转发到构建期生成的 current-tenant.js（唯一真相源）
module.exports = require('./current-tenant');
