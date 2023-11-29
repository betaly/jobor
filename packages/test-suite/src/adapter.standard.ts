import {InMemoryJobBufStore, Job, JobBuffer, JobQueue, JobQueueAdapter, JobQueueService, JobState} from '@jobor/core';
import {firstValueFrom, Subject, take} from 'rxjs';
import {PromiseOrValue} from 'tily/typings/types';

import {genName, getJobFromAdapter, tick} from './utils';

const runningInterval = 50;
const genQueueName = () => genName('queue');

export const adapterStandardTests = (getAdapter: () => PromiseOrValue<JobQueueAdapter>) => {
  describe('Standard JobQueueAdapter Tests', () => {
    let adapter: JobQueueAdapter;
    let jobQueueService: JobQueueService;
    let bufstore: InMemoryJobBufStore;

    beforeEach(async () => {
      adapter = await getAdapter();
      bufstore = new InMemoryJobBufStore();
      jobQueueService = new JobQueueService({
        adapter,
        bufstore: bufstore,
      });
      await jobQueueService.start();
    });

    afterEach(async () => {
      await jobQueueService.stop();
    });

    it('data is passed into job', async () => {
      const subject = new Subject<string>();
      const subNext = firstValueFrom(subject);
      const testQueue = await jobQueueService.createQueue<string>({
        name: genQueueName(),
        process: async job => {
          subject.next(job.data);
        },
      });

      await testQueue.add('hello');
      const data = await subNext;
      expect(data).toBe('hello');
    });

    it('job marked as complete', async () => {
      const subject = new Subject<string>();
      const testQueue = await jobQueueService.createQueue<string>({
        name: genQueueName(),
        process: job => {
          return firstValueFrom(subject);
        },
      });

      const testJob = await testQueue.add('hello');
      expect(testJob.state).toBe(JobState.PENDING);

      await tick(runningInterval);
      expect((await getJobFromAdapter(adapter, testJob)).state).toBe(JobState.RUNNING);

      subject.next('yay');
      subject.complete();

      await tick();

      expect((await getJobFromAdapter(adapter, testJob)).state).toBe(JobState.COMPLETED);
      expect((await getJobFromAdapter(adapter, testJob)).result).toBe('yay');
    });

    it('job marked as failed when exception thrown', async () => {
      const subject = new Subject<string>();
      const testQueue = await jobQueueService.createQueue<string>({
        name: genQueueName(),
        process: async job => {
          throw new Error(await firstValueFrom(subject));
        },
      });

      const testJob = await testQueue.add('hello');
      expect(testJob.state).toBe(JobState.PENDING);

      await tick(runningInterval);
      expect((await getJobFromAdapter(adapter, testJob)).state).toBe(JobState.RUNNING);

      subject.next('uh oh');
      subject.complete();
      await tick();

      expect((await getJobFromAdapter(adapter, testJob)).state).toBe(JobState.FAILED);
      expect((await getJobFromAdapter(adapter, testJob)).error).toBe('uh oh');
    });

    it('job marked as failed when async error thrown', async () => {
      const err = new Error('something bad happened');
      const testQueue = await jobQueueService.createQueue<string>({
        name: genQueueName(),
        process: async job => {
          throw err;
        },
      });

      const testJob = await testQueue.add('hello');
      expect(testJob.state).toBe(JobState.PENDING);

      await tick(runningInterval);
      expect((await getJobFromAdapter(adapter, testJob)).state).toBe(JobState.FAILED);
      expect((await getJobFromAdapter(adapter, testJob)).error).toBe(err.message);
    });

    it('jobs processed in FIFO queue', async () => {
      const subject = new Subject<void>();
      const testQueue = await jobQueueService.createQueue<string>({
        name: genQueueName(),
        process: job => {
          return firstValueFrom(subject.pipe(take(1)));
        },
      });

      const testJob1 = await testQueue.add('1');
      const testJob2 = await testQueue.add('2');
      const testJob3 = await testQueue.add('3');

      const getStates = async () => [
        (await getJobFromAdapter(adapter, testJob1)).state,
        (await getJobFromAdapter(adapter, testJob2)).state,
        (await getJobFromAdapter(adapter, testJob3)).state,
      ];

      expect(await getStates()).toEqual([JobState.RUNNING, JobState.PENDING, JobState.PENDING]);

      subject.next();
      await tick(runningInterval);
      expect(await getStates()).toEqual([JobState.COMPLETED, JobState.RUNNING, JobState.PENDING]);

      subject.next();
      await tick(runningInterval);
      expect(await getStates()).toEqual([JobState.COMPLETED, JobState.COMPLETED, JobState.RUNNING]);

      subject.next();
      await tick(runningInterval);
      expect(await getStates()).toEqual([JobState.COMPLETED, JobState.COMPLETED, JobState.COMPLETED]);

      subject.complete();
    });

    describe('buffering', () => {
      const testQueueName1 = genQueueName();
      const testQueueName2 = genQueueName();

      class TestJobBuffer implements JobBuffer<string> {
        readonly id = 'test-job-buffer';

        collect(job: Job<string>): boolean | Promise<boolean> {
          return job.queueName === testQueueName1;
        }

        reduce(collectedJobs: Array<Job<string>>): Array<Job<string>> {
          const concated = collectedJobs.map(j => j.data).join(' ');
          return [
            new Job({
              ...collectedJobs[0],
              id: undefined,
              data: concated,
            }),
          ];
        }
      }

      let testQueue1: JobQueue<string>;
      let testQueue2: JobQueue<string>;
      const subject1 = new Subject();
      const subject2 = new Subject();
      const testJobBuffer = new TestJobBuffer();

      let testJob1_1: Job;
      let testJob1_2: Job;
      let testJob2_1: Job;
      let testJob2_2: Job;

      beforeEach(async () => {
        testQueue1 = await jobQueueService.createQueue({
          name: testQueueName1,
          process: job => {
            return firstValueFrom(subject1);
          },
        });
        testQueue2 = await jobQueueService.createQueue({
          name: testQueueName2,
          process: job => {
            return firstValueFrom(subject2);
          },
        });

        jobQueueService.addBuffer(testJobBuffer);
      });

      beforeEach(async () => {
        testJob1_1 = await testQueue1.add('hello');
        testJob1_2 = await testQueue1.add('world');
        testJob2_1 = await testQueue2.add('foo');
        testJob2_2 = await testQueue2.add('bar');
      });

      it('buffers the specified jobs', async () => {
        await tick(runningInterval);
        expect(await getJobFromAdapter(adapter, testJob1_1)).toBeUndefined();
        expect(await getJobFromAdapter(adapter, testJob1_2)).toBeUndefined();

        expect((await getJobFromAdapter(adapter, testJob2_1)).state).toBe(JobState.RUNNING);
        expect((await getJobFromAdapter(adapter, testJob2_2)).state).toBe(JobState.PENDING);
      });

      it('flushes and reduces buffered jobs', async () => {
        const result = await jobQueueService.flush(testJobBuffer);

        expect(result.length).toBe(1);
        expect(result[0].data).toBe('hello world');
      });
    });
  });
};
