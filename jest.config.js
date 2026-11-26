module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/tests/**/*.test.[jt]s?(x)'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  collectCoverageFrom: [
    'src/features/billing/domain/**/*.ts',
    'src/shared/formatting/**/*.ts',
    'src/features/backup/validation.ts',
  ],
};
