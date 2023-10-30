import {firstValueFrom, from, interval, race, Subject, Subscription} from 'rxjs';
import {filter, switchMap, take, throttleTime} from 'rxjs/operators';
import {AnyObj} from 'tily/typings/types';

import {BaseJobQueueAdapter} from './base-job-queue-adapter';
import {Job} from './job';
import {ProcessFunc} from './job-queue-adapter';
import {Logger} from './logger';
import {QueueNameProcessStorage} from './queue-name-process-storage';
import {AnyPromise, ID, JobData, JobState} from './types';
import {isObject} from './utils';

/**
 * @description
 * Defines the backoff strategy used when retrying failed jobs. Returns the delay in
 * ms that should pass before the failed job is retried.
 *
 * @docsCategory JobQueue
 * @docsPage types
 */
export type BackoffStrategy = (queueName: string, attemptsMade: number, job: Job) => number;

export interface PollingJobQueueStrategyConfig {
  /**
   * @description
   * How many jobs from a given queue to process concurrently.
   *
   * @default 1
   */
  concurrency?: number;
  /**
   * @description
   * The interval in ms between polling the database for new jobs.
   *
   * @description 200
   */
  pollInterval?: number | ((queueName: string) => number);
  /**
   * @description
   * When a job is added to the JobQueue using `JobQueue.add()`, the calling
   * code may specify the number of retries in case of failure. This option allows
   * you to override that number and specify your own number of retries based on
   * the job being added.
   */
  setRetries?: (queueName: string, job: Job) => number;
  /**
   * @description
   * The strategy used to decide how long to wait before retrying a failed job.
   *
   * @default () => 1000
   */
  backoffStrategy?: BackoffStrategy;
}

const STOP_SIGNAL = Symbol('STOP_SIGNAL');

class ActiveQueue<Data extends JobData<Data> = AnyObj> {
  private timer: NodeJS.Timeout;
  private running = false;
  private activeJobs: Array<Job<Data>> = [];

  private errorNotifier$ = new Subject<[string, string]>();
  private queueStopped$ = new Subject<typeof STOP_SIGNAL>();
  private subscription: Subscription;
  private readonly pollInterval: number;

  constructor(
    private readonly queueName: string,
    private readonly process: (job: Job<Data>) => AnyPromise,
    private readonly jobQueueStrategy: PollingJobQueueStrategy,
  ) {
    this.subscription = this.errorNotifier$.pipe(throttleTime(3000)).subscribe(([message, stack]) => {
      Logger.error(message);
      Logger.debug(stack);
    });
    this.pollInterval =
      typeof this.jobQueueStrategy.pollInterval === 'function'
        ? this.jobQueueStrategy.pollInterval(queueName)
        : this.jobQueueStrategy.pollInterval;
  }

  start() {
    Logger.debug(`Starting JobQueue "${this.queueName}"`);
    this.running = true;
    const runNextJobs = async () => {
      try {
        const runningJobsCount = this.activeJobs.length;
        for (let i = runningJobsCount; i < this.jobQueueStrategy.concurrency; i++) {
          const nextJob = await this.jobQueueStrategy.next(this.queueName);
          if (nextJob) {
            this.activeJobs.push(nextJob);
            await this.jobQueueStrategy.update(nextJob);
            const onProgress = (job: Job) => this.jobQueueStrategy.update(job);
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            nextJob.on('progress', onProgress);
            const cancellationSignal$ = interval(this.pollInterval * 5).pipe(
              switchMap(() => this.jobQueueStrategy.findOne(nextJob.id!)),
              filter(job => job?.state === JobState.CANCELLED),
              take(1),
            );
            const stopSignal$ = this.queueStopped$.pipe(take(1));

            firstValueFrom(race(from(this.process(nextJob)), cancellationSignal$, stopSignal$))
              .then(
                result => {
                  if (result === STOP_SIGNAL) {
                    nextJob.defer();
                  } else if (result instanceof Job && result.state === JobState.CANCELLED) {
                    nextJob.cancel();
                  } else {
                    nextJob.complete(result);
                  }
                },
                err => {
                  nextJob.fail(err);
                },
              )
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              .finally(() => {
                if (!this.running && nextJob.state !== JobState.PENDING) {
                  return;
                }
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                nextJob.off('progress', onProgress);
                return this.onFailOrComplete(nextJob);
              })
              .catch(err => {
                Logger.warn(`Error updating job info: ${JSON.stringify(err)}`);
              });
          }
        }
      } catch (e) {
        this.errorNotifier$.next([
          `Job queue "${this.queueName}" encountered an error (set log level to Debug for trace): ${JSON.stringify(
            e.message,
          )}`,
          e.stack,
        ]);
      }
      if (this.running) {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this.timer = setTimeout(runNextJobs, this.pollInterval);
      }
    };

    // eslint-disable-next-line no-void
    void runNextJobs();
  }

  stop(): Promise<void> {
    this.running = false;
    this.queueStopped$.next(STOP_SIGNAL);
    clearTimeout(this.timer);

    const start = +new Date();
    // Wait for 2 seconds to allow running jobs to complete
    const maxTimeout = 2000;
    let pollTimer: NodeJS.Timeout;
    return new Promise(resolve => {
      const pollActiveJobs = async () => {
        const timedOut = +new Date() - start > maxTimeout;
        if (this.activeJobs.length === 0 || timedOut) {
          clearTimeout(pollTimer);
          resolve();
        } else {
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          pollTimer = setTimeout(pollActiveJobs, 50);
        }
      };
      // eslint-disable-next-line no-void
      void pollActiveJobs();
    });
  }

  private async onFailOrComplete(job: Job<Data>) {
    await this.jobQueueStrategy.update(job);
    this.removeJobFromActive(job);
  }

  private removeJobFromActive(job: Job<Data>) {
    const index = this.activeJobs.indexOf(job);
    this.activeJobs.splice(index, 1);
  }
}

/**
 * @description
 * This class allows easier implementation of {@link JobQueueAdapter} in a polling style.
 * Instead of providing {@link JobQueueAdapter} `start()` you should provide a `next` method.
 *
 * This class should be extended by any strategy which does not support a push-based system
 * to notify on new jobs. It is used by the {@link SqlJobQueueAdapter} and {@link InMemoryJobQueueAdapter}.
 *
 * @docsCategory JobQueue
 */
export abstract class PollingJobQueueStrategy extends BaseJobQueueAdapter {
  public concurrency: number;
  public pollInterval: number | ((queueName: string) => number);
  public setRetries: (queueName: string, job: Job) => number;
  public backOffStrategy?: BackoffStrategy;

  private activeQueues = new QueueNameProcessStorage<ActiveQueue>();

  constructor(config?: PollingJobQueueStrategyConfig);
  constructor(concurrency?: number, pollInterval?: number);
  constructor(concurrencyOrConfig?: number | PollingJobQueueStrategyConfig, maybePollInterval?: number) {
    super();

    if (concurrencyOrConfig && isObject(concurrencyOrConfig)) {
      this.concurrency = concurrencyOrConfig.concurrency ?? 1;
      this.pollInterval = concurrencyOrConfig.pollInterval ?? 200;
      this.backOffStrategy = concurrencyOrConfig.backoffStrategy ?? (() => 1000);
      this.setRetries = concurrencyOrConfig.setRetries ?? ((_, job) => job.retries);
    } else {
      this.concurrency = concurrencyOrConfig ?? 1;
      this.pollInterval = maybePollInterval ?? 200;
      this.setRetries = (_, job) => job.retries;
    }
  }

  async start<Data extends JobData<Data> = object>(queueName: string, process: ProcessFunc<Data>) {
    if (!this.initialized) {
      this.started.set(queueName, process);
      return;
    }
    if (this.activeQueues.has(queueName, process)) {
      return;
    }
    const active = new ActiveQueue<Data>(queueName, process, this);
    active.start();
    this.activeQueues.set(queueName, process, active);
  }

  async stop<Data extends JobData<Data> = object>(queueName: string, process: ProcessFunc<Data>) {
    const active = this.activeQueues.getAndDelete(queueName, process);
    if (!active) {
      return;
    }
    await active.stop();
  }

  async cancelJob(jobId: ID): Promise<Job | undefined> {
    const job = await this.findOne(jobId);
    if (job) {
      job.cancel();
      await this.update(job);
      return job;
    }
  }

  /**
   * @description
   * Should return the next job in the given queue. The implementation is
   * responsible for returning the correct job according to the time of
   * creation.
   */
  abstract next(queueName: string): Promise<Job | undefined>;

  /**
   * @description
   * Update the job details in the store.
   */
  abstract update(job: Job): Promise<void>;

  /**
   * @description
   * Returns a job by its id.
   */
  abstract findOne(id: ID): Promise<Job | undefined>;
}
