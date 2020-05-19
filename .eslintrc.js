module.exports = {
  extends: 'airbnb-base',
  env: {
    mocha: true,
  },
  rules: {
    'max-len': ['error', { code: 180 }],
    'no-useless-constructor': 'off',
    'max-classes-per-file': 'off',
    'class-methods-use-this': 'off',
    'no-unused-vars': ['error', { args: 'none'}],
    'no-plusplus': 'off',
    'no-await-in-loop': 'off',
    'guard-for-in': 'off',
    'no-restricted-syntax': ['error', 'LabeledStatement', 'WithStatement'],
    'import/prefer-default-export': 'off',
    'import/extensions': 'off',
  },
};
