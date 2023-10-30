import {Job} from './job';
import {JobQueueAdapter, ProcessFunc} from './job-queue-adapter';
import {JobData} from './types';

/**
 * @description
 * BaseJobQueueStrategy is responsible for managing the persistence and execution of jobs.
 * It provides basic setup and cleanup operations.
 *
 * @docsCategory JobQueue
 */
export abstract class BaseJobQueueAdapter implements JobQueueAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected started = new Map<string, ProcessFunc<any>>();

  private _initialized = false;

  get initialized(): boolean {
    return this._initialized;
  }

  /**
   * @description
   * Set up the job queue strategy. This method should be called to initialize
   * the strategy and start processing jobs.
   */
  async init() {
    if (!this._initialized) {
      this._initialized = true;

      await this.doInit();
    }
  }

  /**
   * @description
   * Cleanup the job queue strategy. This method should be called to release
   * any resources and stop processing jobs.
   */
  async destroy() {
    if (this._initialized) {
      // Implement any necessary cleanup logic here
      this._initialized = false;
      await this.doDestroy();
    }
  }

  /**
   * @description
   * Add a new job to the queue.
   */
  abstract add<Data extends JobData<Data> = object>(job: Job<Data>): Promise<Job<Data>>;
  /**
   * @description
   * Start the job queue
   */
  abstract start<Data extends JobData<Data> = object>(queueName: string, process: ProcessFunc<Data>): Promise<void>;

  /**
   * @description
   * Stops a queue from running. Its not guaranteed to stop immediately.
   */
  abstract stop<Data extends JobData<Data> = object>(queueName: string, process: ProcessFunc<Data>): Promise<void>;

  protected async doInit() {
    for (const [queueName, process] of this.started) {
      try {
        await this.start(queueName, process);
      } catch (error) {
        console.error(`Error starting job queue for ${queueName}:`, error);
      }
    }
    this.started.clear();
  }

  protected async doDestroy() {
    //
  }
}
