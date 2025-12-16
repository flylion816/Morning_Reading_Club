module.exports = {
  'backend/src/**/*.js': ['eslint --fix', 'prettier --write'],
  'admin/**/*.{ts,vue}': ['eslint --fix', 'prettier --write'],
  'miniprogram/**/*.js': ['eslint --fix', 'prettier --write'],
  '*.{json,md}': ['prettier --write']
};
