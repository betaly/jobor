import {AnyJob, JobBufferStorage} from '@jobor/core';
import {PromiseOrValue} from 'tily/typings/types';

import {genName} from './utils';

export const bufferStorageStandardTests = (getStorage: () => PromiseOrValue<JobBufferStorage>) => {
  describe('Standard JobBufferStorage Tests', () => {
    const bufferId = genName('buffer');
    const jobData = {example: 'data'};
    let storage: JobBufferStorage;
    let testJob: AnyJob;

    beforeEach(async () => {
      storage = await getStorage();
      testJob = new AnyJob({queueName: 'queue-1', data: jobData});
      await storage.flush([bufferId]);
    });

    test('add should save the job to the buffer', async () => {
      await storage.add(bufferId, testJob);
      const size = await storage.bufferSize([bufferId]);
      expect(size[bufferId]).toBe(1);
    });

    test('bufferSize should return the correct number of jobs', async () => {
      await storage.add(bufferId, testJob);
      const size = await storage.bufferSize([bufferId]);
      expect(size[bufferId]).toBe(1);
    });

    test('flush should remove all jobs from the buffer', async () => {
      await storage.add(bufferId, testJob);
      const flushed = await storage.flush([bufferId]);
      expect(flushed[bufferId].length).toBe(1);
      const sizeAfterFlush = await storage.bufferSize([bufferId]);
      expect(sizeAfterFlush[bufferId]).toBe(0);
    });

    test('add multiple jobs to the buffer', async () => {
      const job2 = new AnyJob({queueName: 'queue-1', data: {example: 'data2'}});
      await storage.add(bufferId, testJob);
      await storage.add(bufferId, job2);
      const size = await storage.bufferSize([bufferId]);
      expect(size[bufferId]).toBe(2);
    });

    test('flushing non-existing buffer should return empty object', async () => {
      const flushed = await storage.flush(['nonExistingBuffer']);
      expect(flushed['nonExistingBuffer']).toEqual([]);
    });

    test('flushing without specifying bufferIds should flush all buffers', async () => {
      const otherBufferId = genName('buffer');
      await storage.add(bufferId, testJob);
      await storage.add(otherBufferId, testJob);
      const flushed = await storage.flush();
      expect(flushed[bufferId].length).toBe(1);
      expect(flushed[otherBufferId].length).toBe(1);
      // After flush, bufferSize should be zero
      const size = await storage.bufferSize();
      expect(size[bufferId]).toBeUndefined();
      expect(size[otherBufferId]).toBeUndefined();
    });

    test('getting bufferSize without specifying bufferIds should return sizes for all buffers', async () => {
      await storage.add(bufferId, testJob);
      const otherBufferId = genName('buffer');
      await storage.add(otherBufferId, testJob);
      const sizes = await storage.bufferSize();
      expect(sizes[bufferId]).toBe(1);
      expect(sizes[otherBufferId]).toBe(1);
    });

    test('bufferSize for non-existing buffer should return zero', async () => {
      const sizes = await storage.bufferSize(['nonExistingBuffer']);
      expect(sizes['nonExistingBuffer']).toBe(0);
    });

    test('flush should handle large amounts of jobs', async () => {
      const numberOfJobs = 100;
      const jobs = Array.from({length: numberOfJobs}, (_, i) => new AnyJob({queueName: 'queue-1', data: {number: i}}));

      for (const job of jobs) {
        await storage.add(bufferId, job);
      }

      const flushed = await storage.flush([bufferId]);
      expect(flushed[bufferId].length).toBe(numberOfJobs);
    });
  });
};
