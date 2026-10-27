/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'ES2022',
          module: 'CommonJS',
          esModuleInterop: true,
          skipLibCheck: true,
        },
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!(@scure|@noble|otplib)/)'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  clearMocks: true,
};
