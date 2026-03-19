export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    '<rootDir>/**/*.ts',
    '!<rootDir>/**/__tests__/**',
    '!<rootDir>/index.ts',
    '!<rootDir>/jest.config.ts',
    '!<rootDir>/jest.setup.ts',
  ],
  coverageDirectory: '<rootDir>/../coverage',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testTimeout: 10000,
};