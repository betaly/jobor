import {adapterStandardTests} from '@jobor/test-suite';
import {Redis} from 'ioredis';

import {BullMQJobQueueAdapter} from '../../bullmq-job-queue-adapter';
import {BullMQPAdapterOptions} from '../../types';
import {REDIS_HOST, REDIS_PORT} from '../constants';

describe('BullMQJobQueueAdapter', () => {
  let redis: Redis;
  let adapter: BullMQJobQueueAdapter;

  let options: BullMQPAdapterOptions;

  beforeAll(async () => {
    redis = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      maxRetriesPerRequest: null,
    });
    options = {
      connection: redis,
      workerOptions: {
        concurrency: 1,
      },
    };
  });

  afterAll(async () => {
    await redis.quit();
    redis.disconnect();
  });

  beforeEach(async () => {
    adapter = new BullMQJobQueueAdapter(options);
  });

  adapterStandardTests(() => adapter);
});
