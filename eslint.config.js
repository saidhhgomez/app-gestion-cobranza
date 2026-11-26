const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
module.exports = defineConfig([
  expo,
  { ignores: ['dist/**', 'coverage/**', '.migration-backup/**', '.test-output/**'] },
  { files: ['tests/**/*.{ts,tsx}'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
]);
