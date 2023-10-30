import {AnyObj} from 'tily/typings/types';

import {AnyJob, Job} from './job';
import {JobBufferService} from './job-buffer.service';
import {JobQueueAdapter} from './job-queue-adapter';
import {Logger} from './logger';
import {SubscribableJob} from './subscribable-job';
import {CreateQueueOptions, JobConfig, JobData} from './types';

/**
 * @description
 * A JobQueue is used to process {@link Job}s. A job is added to the queue via the
 * `.add()` method, and the configured {@link JobQueueAdapter} will check for new jobs and process each
 * according to the defined `process` function.
 *
 * *Note*: JobQueue instances should not be directly instantiated. Rather, the
 * {@link JobQueueService} `createQueue()` method should be used (see that service
 * for example usage).
 *
 * @docsCategory JobQueue
 */
export class JobQueue<Data extends JobData<Data> = AnyObj> {
  private running = false;

  constructor(
    private options: CreateQueueOptions<Data>,
    private adapter: JobQueueAdapter,
    private buffers: JobBufferService,
  ) {}

  get name(): string {
    return this.options.name;
  }

  get started(): boolean {
    return this.running;
  }

  /** @internal */
  async start() {
    if (this.running) {
      return;
    }
    this.running = true;
    await this.adapter.start<Data>(this.options.name, this.options.process);
  }

  /** @internal */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }
    this.running = false;
    return this.adapter.stop(this.options.name, this.options.process);
  }

  /**
   * @description
   * Adds a new {@link Job} to the queue. The resolved {@link SubscribableJob} allows the
   * calling code to subscribe to updates to the Job:
   *
   * @example
   * ```ts
   * const job = await this.myQueue.add({ intervalMs, shouldFail }, { retries: 2 });
   * return job.updates().pipe(
   *   map(update => {
   *     // The returned Observable will emit a value for every update to the job
   *     // such as when the `progress` or `status` value changes.
   *     Logger.info(`Job ${update.id}: progress: ${update.progress}`);
   *     if (update.state === JobState.COMPLETED) {
   *       Logger.info(`COMPLETED ${update.id}: ${update.result}`);
   *     }
   *     return update.result;
   *   }),
   *   catchError(err => of(err.message)),
   * );
   * ```
   *
   * Alternatively, if you aren't interested in the intermediate
   * `progress` changes, you can convert to a Promise like this:
   *
   * @example
   * ```ts
   * const job = await this.myQueue.add({ intervalMs, shouldFail }, { retries: 2 });
   * return firstValueFrom(job.updates())
   *   .then(update => update.result),
   *   .catch(err => err.message);
   * ```
   */
  async add(data: Data, options?: Pick<JobConfig<Data>, 'retries'>): Promise<SubscribableJob<Data>> {
    const job = new AnyJob({
      data,
      queueName: this.options.name,
      retries: options?.retries ?? 0,
    });

    const isBuffered = await this.buffers.add(job);
    if (!isBuffered) {
      try {
        const addedJob = await this.adapter.add(job);
        return new SubscribableJob(addedJob, this.adapter);
      } catch (err) {
        Logger.error(`Could not add Job to "${this.name}" queue`, undefined, err.stack);
        return new SubscribableJob(job, this.adapter);
      }
    } else {
      const bufferedJob = new Job({
        ...job,
        data: job.data,
        id: 'buffered',
      });
      return new SubscribableJob(bufferedJob, this.adapter);
    }
  }
}
