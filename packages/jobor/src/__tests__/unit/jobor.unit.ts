/* eslint-disable @typescript-eslint/no-explicit-any */
import BullMQJobQueueAdapter from '@jobor/bullmq';
import {InMemoryJobBufStore, InMemoryJobQueueAdapter} from '@jobor/core';

import {Jobor, loadAdapter, loadStorage} from '../..';

jest.mock('@jobor/bullmq', () => {
  return jest.fn().mockImplementation(() => {
    return {mocked: 'bullmq'};
  });
});

jest.mock('@jobor/bufstore-redis', () => {
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
    it('should load an in-memory bufstore by default', () => {
      const bufstore = loadStorage({});
      expect(bufstore).toBeInstanceOf(InMemoryJobBufStore);
    });

    it('should load the correct bufstore based on the provided name', () => {
      const bufstore = loadStorage({name: 'redis'});
      expect(bufstore).toHaveProperty('mocked', 'redis');
    });

    it('should throw an error for an unknown bufstore', () => {
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

    it('should create with bufstore options', () => {
      const jobor = new Jobor({
        bufstore: {
          name: 'redis',
        },
      });
      expect(jobor).toBeInstanceOf(Jobor);
      expect(jobor.buffers).toHaveProperty('bufstore.mocked', 'redis');
    });
  });
});
