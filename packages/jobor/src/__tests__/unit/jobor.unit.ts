/* eslint-disable @typescript-eslint/no-explicit-any */
import BullMQJobQueueAdapter from '@jobor/bullmq';
import {InMemoryJobBufferStorage, InMemoryJobQueueAdapter} from '@jobor/core';

import {Jobor, loadAdapter, loadStorage} from '../..';

jest.mock('@jobor/bullmq', () => {
  return jest.fn().mockImplementation(() => {
    return {mocked: 'bullmq'};
  });
});

jest.mock('@jobor/storage-redis', () => {
  return jest.fn().mockImplementation(() => {
    return {mocked: 'redis'};
  });
});

describe('Jobor', () => {
  describe('loadAdapter function', () => {
    it('should load an in-memory adapter by default', () => {
      const adapter = loadAdapter({});
      expect(adapter).toBeInstanceOf(InMemoryJobQueueAdapter);

      expect(BullMQJobQueueAdapter).toBeDefined();
    });

    it('should load the correct adapter based on the provided name', () => {
      const adapter = loadAdapter({name: 'bullmq'});
      expect(adapter).toHaveProperty('mocked', 'bullmq');
    });

    it('should throw an error for an unknown adapter', () => {
      expect(() => {
        loadAdapter({name: 'unknown' as any});
      }).toThrow('Adapter unknown is not allowed');
    });
  });

  describe('loadStorage function', () => {
    it('should load an in-memory storage by default', () => {
      const storage = loadStorage({});
      expect(storage).toBeInstanceOf(InMemoryJobBufferStorage);
    });

    it('should load the correct storage based on the provided name', () => {
      const storage = loadStorage({name: 'redis'});
      expect(storage).toHaveProperty('mocked', 'redis');
    });

    it('should throw an error for an unknown storage', () => {
      expect(() => {
        loadStorage({name: 'unknown' as any});
      }).toThrow('Storage unknown is not allowed');
    });
  });

  describe('Jobor class', () => {
    it('should create with adapter options', () => {
      const jobor = new Jobor({
        adapter: {
          name: 'bullmq',
        },
      });
      expect(jobor).toBeInstanceOf(Jobor);
      expect(jobor.adapter).toHaveProperty('mocked', 'bullmq');
    });

    it('should create with storage options', () => {
      const jobor = new Jobor({
        storage: {
          name: 'redis',
        },
      });
      expect(jobor).toBeInstanceOf(Jobor);
      expect(jobor.buffers).toHaveProperty('storage.mocked', 'redis');
    });
  });
});
