import { voxpelli } from '@voxpelli/eslint-config';

export default [
  ...voxpelli({
    noMocha: true,
  }),
  {
    files: ['converter.js'],
    languageOptions: {
      globals: {
        document: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        HTMLInputElement: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
      },
    },
    rules: {
      'n/no-unsupported-features/node-builtins': 'off',
    },
  },
  {
    files: ['test/**/*.js'],
    rules: {
      'n/no-unsupported-features/node-builtins': 'off',
    },
  },
];
