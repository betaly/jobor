import {Job} from './job';
import {AnyPromise, JobData} from './types';

/**
 * @description
 * A function type representing the process to be executed for a job.
 *
 * @param job - The job to be processed.
 * @returns A promise that resolves when the job is complete.
 */
export type ProcessFunc<Data extends JobData<Data> = object> = (job: Job<Data>) => AnyPromise;

/**
 * @description
 * A JobQueueAdapter is responsible for managing the persistence and execution of jobs.
 *
 * @docsCategory JobQueue
 */
export interface JobQueueAdapter {
  /**
   * @description
   * Whether the strategy has been initialized.
   */
  readonly initialized?: boolean;

  /**
   * @description
   * Set up the job queue strategy. This method should be called to initialize
   */
  init(): Promise<void>;

  /**
   * @description
   * Cleanup the job queue strategy. This method should be called to release
   */
  destroy(): Promise<void>;

  /**
   * @description
   * Add a new job to the queue.
   */
  add<Data extends JobData<Data> = object>(job: Job<Data>): Promise<Job<Data>>;

  /**
   * @description
   * Start the job queue
   */
  start<Data extends JobData<Data> = object>(queueName: string, process: ProcessFunc<Data>): Promise<void>;

  /**
   * @description
   * Stops a queue from running. Its not guaranteed to stop immediately.
   */
  stop<Data extends JobData<Data> = object>(queueName: string, process: ProcessFunc<Data>): Promise<void>;
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isJobQueueAdapter(x: any): x is JobQueueAdapter {
  return x && typeof x.add === 'function' && typeof x.start === 'function' && typeof x.stop === 'function';
}
