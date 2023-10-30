export const REDIS_HOST = 'localhost';
export const REDIS_PORT = process.env.CI ? +(process.env.TEST_REDIS_PORT || 6379) : 6379;
