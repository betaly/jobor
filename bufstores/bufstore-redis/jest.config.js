module.exports = {
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  testMatch: ['**/?(*.)+(spec|test|unit|integration|acceptance).[jt]s?(x)'],
  testPathIgnorePatterns: ['node_modules', 'dist'],
  testEnvironment: 'node',
  coverageReporters: ['html', 'text', 'text-summary', 'cobertura'],
  testTimeout: 300000,
  globalSetup: '../../scripts/jest-setup.ts',
  globalTeardown: '../../scripts/jest-teardown.ts',
};
