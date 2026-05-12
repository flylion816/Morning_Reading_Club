module.exports = {
  env: {
    node: true,
    es2021: true
  },
  extends: ['eslint:recommended', 'airbnb-base', 'plugin:node/recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module'
  },
  settings: {
    node: {
      version: '>=14.0.0'
    }
  },
  rules: {
    'no-console': 'off',
    'no-underscore-dangle': ['error', { allow: ['_id', '_bsontype'] }],
    'consistent-return': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'node/no-unsupported-features/es-syntax': 'off',
    'import/extensions': 'off',
    'node/no-missing-import': 'off',

    // Airbnb's browser/transpiler-era style rules are poor fits for this Node service.
    'arrow-body-style': 'warn',
    camelcase: 'warn',
    'global-require': 'warn',
    'import/newline-after-import': 'warn',
    'import/order': 'warn',
    'no-continue': 'off',
    'no-await-in-loop': 'off',
    'no-else-return': 'warn',
    'no-lonely-if': 'warn',
    'no-nested-ternary': 'warn',
    'no-param-reassign': 'warn',
    'no-plusplus': 'off',
    'no-process-exit': 'warn',
    'no-restricted-syntax': 'off',
    'no-shadow': 'warn',
    'object-shorthand': 'warn',
    'prefer-const': 'warn',
    'prefer-template': 'warn',
    radix: 'warn',
    'func-names': 'warn',
    'prefer-destructuring': 'warn',
    'class-methods-use-this': 'warn',
    'no-use-before-define': ['error', { functions: false, classes: true, variables: true }]
  },
  overrides: [
    {
      files: ['tests/**/*.js'],
      env: {
        mocha: true
      },
      rules: {
        'node/no-unpublished-require': 'off',
        'no-unused-expressions': 'off',
        'no-underscore-dangle': 'off',
        'guard-for-in': 'warn',
        'global-require': 'off',
        'dot-notation': 'warn',
        'no-loop-func': 'warn',
        'no-promise-executor-return': 'warn',
        'no-return-await': 'warn',
        'prefer-object-spread': 'warn',
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
      }
    }
  ]
};
