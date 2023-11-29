import {bufferStorageStandardTests} from '@jobor/test-suite';
import {Redis} from 'ioredis';

import {RedisJobBufStore} from '../../redis-job-bufstore';

const redisOptions = {host: 'localhost', port: 6379};

describe('RedisJobBufStore Integration Tests', () => {
  let bufstore: RedisJobBufStore;

  beforeAll(() => {
    // Connect to the Redis server before all tests
    bufstore = new RedisJobBufStore({connection: new Redis(redisOptions)});
  });

  afterAll(async () => {
    // Disconnect from the Redis server after all tests
    await bufstore.client.quit();
  });

  bufferStorageStandardTests(() => bufstore);
});
