import {Job} from '@jobor/core';
import {ConnectionOptions, QueueOptions, WorkerOptions} from 'bullmq';

import {RedisHealthIndicator} from './redis-health-indicator';

/**
 * @description
 * Configuration options for the BullMQJobQueueAdapter
 *
 * @docsCategory core plugins/JobQueuePlugin
 * @docsPage BullMQPluginOptions
 * @docsWeight 0
 */
export interface BullMQPAdapterOptions {
  redisHealthIndicator?: RedisHealthIndicator;
  /**
   * @description
   * Connection options which will be passed directly to BullMQ when
   * creating a new Queue, Worker and Scheduler instance.
   *
   * If omitted, it will attempt to connect to Redis at `127.0.0.1:6379`.
   */
  connection?: ConnectionOptions;
  /**
   * @description
   * Additional options used when instantiating the BullMQ
   * Queue instance.
   * See the [BullMQ QueueOptions docs](https://github.com/taskforcesh/bullmq/blob/master/docs/gitbook/api/bullmq.queueoptions.md)
   */
  queueOptions?: Exclude<QueueOptions, 'connection'>;
  /**
   * @description
   * Additional options used when instantiating the BullMQ
   * Worker instance.
   * See the [BullMQ WorkerOptions docs](https://github.com/taskforcesh/bullmq/blob/master/docs/gitbook/api/bullmq.workeroptions.md)
   */
  workerOptions?: Exclude<WorkerOptions, 'connection'>;
  /**
   * @description
   * When a job is added to the JobQueue using `JobQueue.add()`, the calling
   * code may specify the number of retries in case of failure. This option allows
   * you to override that number and specify your own number of retries based on
   * the job being added.
   *
   * @example
   * ```ts
   * setRetries: (queueName, job) => {
   *   if (queueName === 'send-email') {
   *     // Override the default number of retries
   *     // for the 'send-email' job because we have
   *     // a very unreliable email service.
   *     return 10;
   *   }
   *   return job.retries;
   * }
   *  ```
   *

   */
  setRetries?: (queueName: string, job: Job) => number;
  /**
   * @description
   * This allows you to specify the backoff settings when a failed job gets retried.
   * In other words, this determines how much time should pass before attempting to
   * process the failed job again. If the function returns `undefined`, the default
   * value of exponential/1000ms will be used.
   *
   * @example
   * ```ts
   * setBackoff: (queueName, job) => {
   *   return {
   *     type: 'exponential', // or 'fixed'
   *     delay: 10000 // first retry after 10s, second retry after 20s, 40s,...
   *   };
   * }
   * ```

   * @default 'exponential', 1000
   */
  setBackoff?: (queueName: string, job: Job) => BackoffOptions | undefined;
}

/**
 * @description
 * Configuration for the backoff function when retrying failed jobs.
 *

 * @docsCategory core plugins/JobQueuePlugin
 * @docsPage BullMQPluginOptions
 * @docsWeight 1
 */
export interface BackoffOptions {
  type: 'exponential' | 'fixed';
  delay: number;
}

/**
 * @description
 * A definition for a Lua script used to define custom behavior in Redis
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars,@typescript-eslint/no-explicit-any
export interface CustomScriptDefinition<T, Args extends any[]> {
  name: string;
  script: string;
  numberOfKeys: number;
}
