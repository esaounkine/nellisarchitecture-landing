import globals from 'globals';
import { configs, plugins } from 'eslint-config-airbnb-extended';

const nodeFiles = ['build-news.js', 'test/**/*.js', 'eslint.config.mjs'];
const browserFiles = ['js/**/*.js'];

export default [
  {
    ignores: [
      '**/*',
      '!build-news.js',
      '!eslint.config.mjs',
      '!js/',
      '!js/static-backend.js',
      '!test/',
      '!test/**',
    ],
  },
  plugins.stylistic,
  plugins.importX,
  plugins.node,
  ...configs.base.recommended,
  ...configs.node.recommended.map((config) => ({ ...config, files: nodeFiles })),
  {
    files: nodeFiles,
    languageOptions: { globals: globals.node },
    rules: {
      'n/no-sync': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['eslint.config.mjs'],
    languageOptions: { sourceType: 'module' },
    rules: { 'import-x/no-extraneous-dependencies': ['error', { devDependencies: true }] },
  },
  {
    files: ['build-news.js', 'test/**/*.js'],
    languageOptions: { sourceType: 'commonjs' },
  },
  {
    files: browserFiles,
    languageOptions: { sourceType: 'script', globals: globals.browser },
    rules: {
      'no-underscore-dangle': 'off',
      strict: ['error', 'function'],
    },
  },
];
