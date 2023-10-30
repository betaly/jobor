import {firstValueFrom, Subject} from 'rxjs';
import {take} from 'rxjs/operators';

import {AnyJob, Job} from '../../job';
import {JobBuffer} from '../../job-buffer';
import {JobQueue} from '../../job-queue';
import {JobQueueOptions, JobQueueService} from '../../job-queue.service';
import {ProcessContext} from '../../process-context';
import {TestingJobQueueStrategy} from '../../testing-job-queue-strategy';
import {JobState} from '../../types';
import {TestingJobBufferStorageStrategy} from '../helpers';

const queuePollInterval = 10;
const backoffStrategySpy = jest.fn();

function createJobQueueStrategy(): TestingJobQueueStrategy {
  return new TestingJobQueueStrategy({
    pollInterval: queuePollInterval,
    backoffStrategy: backoffStrategySpy,
  });
}

function createJobBufferStorageStrategy(): TestingJobBufferStorageStrategy {
  return new TestingJobBufferStorageStrategy();
}

const jobQueueStrategy = createJobQueueStrategy();
const jobBufferStorageStrategy = createJobBufferStorageStrategy();
const jobQueueOptions: JobQueueOptions = {
  adapter: jobQueueStrategy,
  activeQueues: [],
  storage: jobBufferStorageStrategy,
};

class TestJobQueueService extends JobQueueService {
  activeQueues?: string[];
}

describe('JobQueueService', () => {
  let jobQueueService: TestJobQueueService;

  beforeEach(async () => {
    ProcessContext.setProcessMode('server');
    jobQueueService = new TestJobQueueService(jobQueueOptions);
    await jobQueueService.start();
  });

  afterEach(async () => {
    await jobQueueService.stop();
  });

  it('data is passed into job', async () => {
    const subject = new Subject<string>();
    const subNext = firstValueFrom(subject);
    const testQueue = await jobQueueService.createQueue<string>({
      name: 'test',
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
      name: 'test',
      process: job => {
        return firstValueFrom(subject);
      },
    });

    const testJob = await testQueue.add('hello');
    expect(testJob.state).toBe(JobState.PENDING);

    await tick(queuePollInterval);
    expect((await getJob(testJob)).state).toBe(JobState.RUNNING);

    subject.next('yay');
    subject.complete();

    await tick();

    expect((await getJob(testJob)).state).toBe(JobState.COMPLETED);
    expect((await getJob(testJob)).result).toBe('yay');
  });

  it('job marked as failed when exception thrown', async () => {
    const subject = new Subject<string>();
    const testQueue = await jobQueueService.createQueue<string>({
      name: 'test',
      process: async job => {
        throw await firstValueFrom(subject);
      },
    });

    const testJob = await testQueue.add('hello');
    expect(testJob.state).toBe(JobState.PENDING);

    await tick(queuePollInterval);
    expect((await getJob(testJob)).state).toBe(JobState.RUNNING);

    subject.next('uh oh');
    subject.complete();
    await tick();

    expect((await getJob(testJob)).state).toBe(JobState.FAILED);
    expect((await getJob(testJob)).error).toBe('uh oh');
  });

  it('job marked as failed when async error thrown', async () => {
    const err = new Error('something bad happened');
    const testQueue = await jobQueueService.createQueue<string>({
      name: 'test',
      process: async job => {
        throw err;
      },
    });

    const testJob = await testQueue.add('hello');
    expect(testJob.state).toBe(JobState.PENDING);

    await tick(queuePollInterval);
    expect((await getJob(testJob)).state).toBe(JobState.FAILED);
    expect((await getJob(testJob)).error).toBe(err.message);
  });

  it('jobs processed in FIFO queue', async () => {
    const subject = new Subject<void>();
    const testQueue = await jobQueueService.createQueue<string>({
      name: 'test',
      process: job => {
        return firstValueFrom(subject.pipe(take(1)));
      },
    });

    const testJob1 = await testQueue.add('1');
    const testJob2 = await testQueue.add('2');
    const testJob3 = await testQueue.add('3');

    const getStates = async () => [
      (await getJob(testJob1)).state,
      (await getJob(testJob2)).state,
      (await getJob(testJob3)).state,
    ];

    await tick(queuePollInterval);

    expect(await getStates()).toEqual([JobState.RUNNING, JobState.PENDING, JobState.PENDING]);

    subject.next();
    await tick();
    expect(await getStates()).toEqual([JobState.COMPLETED, JobState.PENDING, JobState.PENDING]);

    await tick(queuePollInterval);
    expect(await getStates()).toEqual([JobState.COMPLETED, JobState.RUNNING, JobState.PENDING]);

    subject.next();
    await tick();
    expect(await getStates()).toEqual([JobState.COMPLETED, JobState.COMPLETED, JobState.PENDING]);

    await tick(queuePollInterval);
    expect(await getStates()).toEqual([JobState.COMPLETED, JobState.COMPLETED, JobState.RUNNING]);

    subject.next();
    await tick();
    expect(await getStates()).toEqual([JobState.COMPLETED, JobState.COMPLETED, JobState.COMPLETED]);

    subject.complete();
  });

  it('with concurrency', async () => {
    const testingJobQueueStrategy = jobQueueOptions.adapter as TestingJobQueueStrategy;

    testingJobQueueStrategy.concurrency = 2;

    const subject = new Subject<void>();
    const testQueue = await jobQueueService.createQueue<string>({
      name: 'test',
      process: job => {
        return firstValueFrom(subject.pipe(take(1)));
      },
    });

    const testJob1 = await testQueue.add('1');
    const testJob2 = await testQueue.add('2');
    const testJob3 = await testQueue.add('3');

    const getStates = async () => [
      (await getJob(testJob1)).state,
      (await getJob(testJob2)).state,
      (await getJob(testJob3)).state,
    ];

    await tick(queuePollInterval);

    expect(await getStates()).toEqual([JobState.RUNNING, JobState.RUNNING, JobState.PENDING]);

    subject.next();
    await tick();
    expect(await getStates()).toEqual([JobState.COMPLETED, JobState.COMPLETED, JobState.PENDING]);

    await tick(queuePollInterval);
    expect(await getStates()).toEqual([JobState.COMPLETED, JobState.COMPLETED, JobState.RUNNING]);

    subject.next();
    await tick();
    expect(await getStates()).toEqual([JobState.COMPLETED, JobState.COMPLETED, JobState.COMPLETED]);

    subject.complete();
  });

  it('processes existing jobs on start', async () => {
    await jobQueueStrategy.prePopulate([
      new Job({
        queueName: 'test',
        data: {},
        id: 'job-1',
      }),
      new Job({
        queueName: 'test',
        data: {},
        id: 'job-2',
      }),
    ]);

    await jobQueueService.createQueue<string>({
      name: 'test',
      process: async job => {
        return;
      },
    });

    const job1 = await getJob('job-1');
    const job2 = await getJob('job-2');
    expect(job1?.state).toBe(JobState.COMPLETED);
    expect(job2?.state).toBe(JobState.RUNNING);

    await tick(queuePollInterval);
    expect((await getJob('job-2')).state).toBe(JobState.COMPLETED);
  });

  it('retries', async () => {
    backoffStrategySpy.mockClear();
    const subject = new Subject<boolean>();
    const testQueue = await jobQueueService.createQueue<string>({
      name: 'test',
      process: job => {
        return firstValueFrom(subject.pipe(take(1))).then(success => {
          if (!success) {
            throw new Error();
          }
        });
      },
    });

    const testJob = await testQueue.add('hello', {retries: 2});

    await tick(queuePollInterval);
    expect((await getJob(testJob)).state).toBe(JobState.RUNNING);
    expect((await getJob(testJob)).isSettled).toBe(false);

    subject.next(false);
    await tick();
    expect((await getJob(testJob)).state).toBe(JobState.RETRYING);
    expect((await getJob(testJob)).isSettled).toBe(false);

    await tick(queuePollInterval);

    expect(backoffStrategySpy).toHaveBeenCalledTimes(1);
    expect(backoffStrategySpy.mock.calls[0]).toEqual(['test', 1, await getJob(testJob)]);

    subject.next(false);
    await tick();
    expect((await getJob(testJob)).state).toBe(JobState.RETRYING);
    expect((await getJob(testJob)).isSettled).toBe(false);

    await tick(queuePollInterval);

    expect(backoffStrategySpy).toHaveBeenCalledTimes(2);
    expect(backoffStrategySpy.mock.calls[1]).toEqual(['test', 2, await getJob(testJob)]);

    subject.next(false);
    await tick();
    expect((await getJob(testJob)).state).toBe(JobState.FAILED);
    expect((await getJob(testJob)).isSettled).toBe(true);
  });

  it('sets long-running jobs to pending on destroy', async () => {
    const testingJobQueueStrategy = jobQueueOptions.adapter as TestingJobQueueStrategy;

    const subject = new Subject<boolean>();
    const testQueue = await jobQueueService.createQueue<string>({
      name: 'test',
      process: job => {
        return firstValueFrom(subject);
      },
    });

    const testJob = await testQueue.add('hello');

    await tick(queuePollInterval);

    expect((await testingJobQueueStrategy.findOne(testJob.id!))?.state).toBe(JobState.RUNNING);

    await testQueue.stop();

    expect((await testingJobQueueStrategy.findOne(testJob.id!))?.state).toBe(JobState.PENDING);
  }, 10000);

  it('should start a queue if its name is in the active list', async () => {
    jobQueueService.activeQueues = ['test'];

    const subject = new Subject();
    const testQueue = await jobQueueService.createQueue<string>({
      name: 'test',
      process: job => {
        return firstValueFrom(subject);
      },
    });

    const testJob = await testQueue.add('hello');
    expect(testJob.state).toBe(JobState.PENDING);

    await tick(queuePollInterval);
    expect((await getJob(testJob)).state).toBe(JobState.RUNNING);

    subject.next('yay');
    subject.complete();
    await tick();

    expect((await getJob(testJob)).state).toBe(JobState.COMPLETED);
    expect((await getJob(testJob)).result).toBe('yay');
  });

  it('should not start a queue if its name is in the active list', async () => {
    jobQueueService.activeQueues = ['another'];

    const subject = new Subject();
    const testQueue = await jobQueueService.createQueue<string>({
      name: 'test',
      process: job => {
        return firstValueFrom(subject);
      },
    });

    const testJob = await testQueue.add('hello');
    expect(testJob.state).toBe(JobState.PENDING);

    await tick(queuePollInterval);
    expect((await getJob(testJob)).state).toBe(JobState.PENDING);

    subject.next('yay');
    subject.complete();

    expect((await getJob(testJob)).state).toBe(JobState.PENDING);
  });

  describe('buffering', () => {
    class TestJobBuffer implements JobBuffer<string> {
      readonly id: 'test-job-buffer';

      collect(job: Job<string>): boolean | Promise<boolean> {
        return job.queueName === 'buffer-test-queue-1';
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

    beforeEach(async () => {
      testQueue1 = await jobQueueService.createQueue({
        name: 'buffer-test-queue-1',
        process: job => {
          return firstValueFrom(subject1);
        },
      });
      testQueue2 = await jobQueueService.createQueue({
        name: 'buffer-test-queue-2',
        process: job => {
          return firstValueFrom(subject2);
        },
      });

      jobQueueService.addBuffer(testJobBuffer);
    });

    it('buffers the specified jobs', async () => {
      const testJob1_1 = await testQueue1.add('hello');
      const testJob1_2 = await testQueue1.add('world');
      const testJob2_1 = await testQueue2.add('foo');
      const testJob2_2 = await testQueue2.add('bar');

      await tick(queuePollInterval);
      expect(await getJob(testJob1_1)).toBeUndefined();
      expect(await getJob(testJob1_2)).toBeUndefined();

      // TODO checking below
      expect((await getJob(testJob2_1)).state).toBe(JobState.RUNNING);
      expect((await getJob(testJob2_2)).state).toBe(JobState.RUNNING);

      const bufferedJobs = jobBufferStorageStrategy.getBufferedJobs(testJobBuffer.id);
      expect(bufferedJobs.map(j => j.data)).toEqual(['hello', 'world']);
    });

    it('flushes and reduces buffered jobs', async () => {
      const result = await jobQueueService.flush(testJobBuffer);

      expect(result.length).toBe(1);
      expect(result[0].data).toBe('hello world');
    });
  });

  function getJob(job: AnyJob | string): Promise<Job> {
    const id = typeof job === 'string' ? job : job.id!;
    return jobQueueStrategy.findOne(id) as Promise<Job>;
  }
});

function tick(ms = 0): Promise<void> {
  return new Promise<void>(resolve => {
    if (ms > 0) {
      setTimeout(resolve, ms);
    } else {
      process.nextTick(resolve);
    }
  });
}
