/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Suites share a single SQLite file; run them serially to avoid
  // UNIQUE/foreign-key clashes between concurrent beforeEach seeds.
  maxWorkers: 1,
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
};
