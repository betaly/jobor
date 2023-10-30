import {bufferStorageStandardTests} from '@jobor/test-suite';
import {Redis} from 'ioredis';

import {RedisJobBufferStorage} from '../../redis-job-buffer-storage';

const redisOptions = {host: 'localhost', port: 6379};

describe('RedisJobBufferStorage Integration Tests', () => {
  let storage: RedisJobBufferStorage;

  beforeAll(() => {
    // Connect to the Redis server before all tests
    storage = new RedisJobBufferStorage({connection: new Redis(redisOptions)});
  });

  afterAll(async () => {
    // Disconnect from the Redis server after all tests
    await storage.client.quit();
  });

  bufferStorageStandardTests(() => storage);
});
