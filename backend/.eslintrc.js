module.exports = {
  env: {
    node: true,
    es2021: true,
    mocha: true
  },
  extends: ['eslint:recommended', 'airbnb-base', 'plugin:node/recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module'
  },
  rules: {
    'no-console': 'off',
    'no-underscore-dangle': ['error', { allow: ['_id'] }],
    'consistent-return': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'node/no-unsupported-features/es-syntax': 'off',
    'import/extensions': 'off',
    'node/no-missing-import': 'off'
  }
};
