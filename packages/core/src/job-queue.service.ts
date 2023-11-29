import {loggerCtx} from './constants';
import {Job} from './job';
import {JobBufStore} from './job-buf-store';
import {AnyJobBuffer} from './job-buffer';
import {JobBufferService} from './job-buffer.service';
import {JobQueue} from './job-queue';
import {JobQueueAdapter} from './job-queue-adapter';
import {Logger} from './logger';
import {CreateQueueOptions, JobData, JobQueueStatus} from './types';

/**
 * @description
 * Options related to the built-in job queue.
 *
 * @docsCategory JobQueue
 */
export interface JobQueueOptions {
  /**
   * @description
   * Defines how the jobs in the queue are persisted and accessed.
   *
   * @default InMemoryJobQueueAdapter
   */
  adapter: JobQueueAdapter;

  /**
   * @description
   * Defines how the jobs in the buffer are persisted and accessed.
   *
   * @default InMemoryJobBufStoreStrategy
   */
  bufstore: JobBufStore;

  /**
   * @description
   * Defines the queues that will run in this process.
   * This can be used to configure only certain queues to run in this process.
   * If its empty all queues will be run. Note: this option is primarily intended
   * to apply to the Worker process. Jobs will _always_ get published to the queue
   * regardless of this setting, but this setting determines whether they get
   * _processed_ or not.
   */
  activeQueues?: string[];

  /**
   * @description
   * Prefixes all job queue names with the passed string. This is useful with multiple deployments
   * in cloud environments using services such as Amazon SQS or Google Cloud Tasks.
   *
   * For example, we might have a staging and a production deployment in the same account/project and
   * each one will need its own task queue. We can achieve this with a prefix.
   *
   * @since 1.5.0
   */
  prefix?: string;
}

/**
 * @description
 * The JobQueueService is responsible for creating and managing {@link JobQueue} instances.
 *
 * @docsCategory JobQueue
 */
export class JobQueueService {
  readonly adapter: JobQueueAdapter;
  readonly buffers: JobBufferService;
  protected activeQueues?: string[];
  protected prefix?: string;
  protected queues: Array<JobQueue> = [];
  protected isStarted = false;

  constructor(options: JobQueueOptions) {
    this.adapter = options.adapter;
    this.prefix = options.prefix;
    this.activeQueues = options.activeQueues;
    this.buffers = new JobBufferService(options);
  }

  /**
   * @description
   * Configures and creates a new {@link JobQueue} instance.
   */
  async createQueue<Data extends JobData<Data>>(options: CreateQueueOptions<Data>): Promise<JobQueue<Data>> {
    if (this.prefix) {
      options = {...options, name: `${this.prefix}${options.name}`};
    }
    const queue = new JobQueue(options, this.adapter, this.buffers);
    if (this.isStarted && this.shouldStartQueue(queue.name)) {
      await queue.start();
    }
    this.queues.push(queue);
    return queue;
  }

  /**
   * @description
   * Starts all registered JobQueues.
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }
    this.isStarted = true;
    await this.adapter.init();
    for (const queue of this.queues) {
      if (!queue.started && this.shouldStartQueue(queue.name)) {
        Logger.info(`Starting queue: ${queue.name}`, loggerCtx);
        await queue.start();
      }
    }
  }

  /**
   * @description
   * Stops all registered JobQueues.
   */
  async stop() {
    if (!this.isStarted) {
      return;
    }
    this.isStarted = false;
    await Promise.all(this.queues.map(q => q.stop()));
    await this.adapter.destroy();
  }

  /**
   * @description
   * Adds a {@link JobBuffer}, which will make it active and begin collecting
   * jobs to buffer.
   */
  addBuffer(buffer: AnyJobBuffer) {
    this.buffers.addBuffer(buffer);
  }

  /**
   * @description
   * Removes a {@link JobBuffer}, prevent it from collecting and buffering any
   * subsequent jobs.
   *

   */
  removeBuffer(buffer: AnyJobBuffer) {
    this.buffers.removeBuffer(buffer);
  }

  /**
   * @description
   * Returns an object containing the number of buffered jobs arranged by bufferId. This
   * can be used to decide whether a particular buffer has any jobs to flush.
   *
   * Passing in JobBuffer instances _or_ ids limits the results to the specified JobBuffers.
   * If no argument is passed, sizes will be returned for _all_ JobBuffers.
   *
   * @example
   * ```ts
   * const sizes = await this.jobQueueService.bufferSize('buffer-1', 'buffer-2');
   *
   * // sizes = { 'buffer-1': 12, 'buffer-2': 3 }
   * ```
   *

   */
  bufferSize(...forBuffers: Array<AnyJobBuffer | string>): Promise<{[bufferId: string]: number}> {
    return this.buffers.bufferSize(forBuffers);
  }

  /**
   * @description
   * Flushes the specified buffers, which means that the buffer is cleared and the jobs get
   * sent to the job queue for processing. Before sending the jobs to the job queue,
   * they will be passed through each JobBuffer's `reduce()` method, which is can be used
   * to optimize the amount of work to be done by e.g. de-duplicating identical jobs or
   * aggregating data over the collected jobs.
   *
   * Passing in JobBuffer instances _or_ ids limits the action to the specified JobBuffers.
   * If no argument is passed, _all_ JobBuffers will be flushed.
   *
   * Returns an array of all Jobs which were added to the job queue.
   *

   */
  flush(...forBuffers: Array<AnyJobBuffer | string>): Promise<Job[]> {
    return this.buffers.flush(forBuffers);
  }

  /**
   * @description
   * Returns an array of `{ name: string; running: boolean; }` for each
   * registered JobQueue.
   */
  getJobQueues(): JobQueueStatus[] {
    return this.queues.map(queue => ({
      name: queue.name,
      running: queue.started,
    }));
  }

  private shouldStartQueue(queueName: string): boolean {
    if (this.activeQueues?.length ?? 0 > 0) {
      if (!this.activeQueues?.includes(queueName)) {
        return false;
      }
    }

    return true;
  }
}
