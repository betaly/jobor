/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ID,
  InspectableJobQueueAdapter,
  Job,
  JobData,
  JobListOptions,
  JobState,
  Logger,
  notNullOrUndefined,
  PaginatedList,
} from '@jobor/core';
import {BErrors} from 'berrors';
import Bull, {ConnectionOptions, Job as BullJob, JobType, Processor, Queue, Worker, WorkerOptions} from 'bullmq';
import {EventEmitter} from 'events';
import {Cluster, Redis} from 'ioredis';
import mergeDeep from 'tily/object/mergeDeep';
import {AnyObj} from 'tily/typings/types';

import {ALL_JOB_TYPES, loggerCtx} from './constants';
import {getJobsByType} from './scripts/get-jobs-by-type';
import {BullMQPAdapterOptions, CustomScriptDefinition} from './types';

const QUEUE_NAME = 'jobor-job-queue';
const DEFAULT_CONCURRENCY = 3;

/**
 * @description
 * This JobQueueAdapter uses [BullMQ](https://docs.bullmq.io/) to implement a push-based job queue
 * on top of Redis. It should not be used alone, but as part of the {@link BullMQJobQueueAdapter}.
 *
 * @docsCategory core plugins/JobQueuePlugin
 */
export class BullMQJobQueueAdapter implements InspectableJobQueueAdapter {
  redisConnection: Redis | Cluster;

  private redisHealthIndicator?;
  private connectionOptions: ConnectionOptions;
  private queue: Queue;
  private worker?: Worker;
  private workerProcessor: Processor;
  private options: BullMQPAdapterOptions;
  private queueNameProcessFnMap = new Map<string, (job: Job) => Promise<any>>();
  private stopped = false;

  constructor(options: BullMQPAdapterOptions = {}) {
    this.options = mergeDeep(
      {
        workerOptions: {
          removeOnComplete: {
            age: 60 * 60 * 24 * 30,
            count: 5000,
          },
          removeOnFail: {
            age: 60 * 60 * 24 * 30,
            count: 5000,
          },
        },
      },
      options,
    );

    this.redisHealthIndicator = this.options.redisHealthIndicator;
    this.connectionOptions =
      this.options.connection ??
      ({
        host: 'localhost',
        port: 6379,
        maxRetriesPerRequest: null,
      } as ConnectionOptions);
  }

  private _initialized = false;

  get initialized(): boolean {
    return this._initialized;
  }

  async init(): Promise<void> {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    this.redisConnection =
      this.connectionOptions instanceof EventEmitter ? this.connectionOptions : new Redis(this.connectionOptions);
    (this.redisConnection.options as AnyObj).maxRetriesPerRequest = null;

    this.defineCustomLuaScripts();

    Logger.info('Checking Redis connection...', loggerCtx);
    const health = await this.redisHealthIndicator?.isHealthy('redis');
    if (health) {
      if (health.redis.status === 'down') {
        Logger.error('Could not connect to Redis', loggerCtx);
      } else {
        Logger.info('Connected to Redis ✔', loggerCtx);
      }
    }

    this.queue = new Queue(QUEUE_NAME, {
      ...this.options.queueOptions,
      connection: this.redisConnection,
    })
      .on('error', (e: any) => Logger.error(`BullMQ Queue error: ${JSON.stringify(e.message)}`, loggerCtx, e.stack))
      .on('resumed', () => Logger.verbose('BullMQ Queue resumed', loggerCtx))
      .on('paused', () => Logger.verbose('BullMQ Queue paused', loggerCtx));

    if (await this.queue.isPaused()) {
      await this.queue.resume();
    }

    this.workerProcessor = async (bullJob: Bull.Job) => {
      const queueName = bullJob.name;
      Logger.debug(
        `Job ${bullJob.id ?? ''} [${queueName}] starting (attempt ${bullJob.attemptsMade + 1} of ${
          bullJob.opts.attempts ?? 1
        })`,
      );
      const processFn = this.queueNameProcessFnMap.get(queueName);
      if (processFn) {
        const job = await this.createJoborJob(bullJob);
        // eslint-disable-next-line
        job.on('progress', _job => bullJob.updateProgress(_job.progress));
        const result = await processFn(job);
        await bullJob.updateProgress(100);
        return result;
      }
      throw new BErrors.InternalServerError(`No processor defined for the queue "${queueName}"`);
    };
  }

  async destroy() {
    if (!this._initialized) {
      return;
    }
    this._initialized = false;
    await this.close();
    this.worker = undefined;

    // TODO is this is necessary? if not, jest will not exit.
    await this.redisConnection.quit();
  }

  async add<Data extends JobData<Data> = object>(job: Job<Data>): Promise<Job<Data>> {
    const retries = this.options.setRetries?.(job.queueName, job) ?? job.retries ?? 0;
    const backoff = this.options.setBackoff?.(job.queueName, job) ?? {
      delay: 1000,
      type: 'exponential',
    };
    const bullJob = await this.queue.add(job.queueName, job.data, {
      priority: job.priority,
      attempts: retries + 1,
      backoff,
    });
    return this.createJoborJob(bullJob);
  }

  async cancelJob(jobId: string): Promise<Job | undefined> {
    const bullJob = await this.queue.getJob(jobId);
    if (bullJob) {
      if (await bullJob.isActive()) {
        // Not yet possible in BullMQ, see
        // https://github.com/taskforcesh/bullmq/issues/632
        throw new BErrors.InternalServerError('Cannot cancel a running job');
      }
      try {
        await bullJob.remove();
        return await this.createJoborJob(bullJob);
      } catch (e: any) {
        const message = `Error when cancelling job: ${JSON.stringify(e.message)}`;
        Logger.error(message, loggerCtx);
        throw new BErrors.InternalServerError(message);
      }
    }
  }

  async findMany(options?: JobListOptions): Promise<PaginatedList<Job>> {
    const skip = options?.skip ?? 0;
    const take = options?.take ?? 10;
    let jobTypes: JobType[] = ALL_JOB_TYPES;
    const stateFilter = options?.filter?.state;
    if (stateFilter?.eq) {
      switch (stateFilter.eq) {
        case 'PENDING':
          jobTypes = ['wait'];
          break;
        case 'RUNNING':
          jobTypes = ['active'];
          break;
        case 'COMPLETED':
          jobTypes = ['completed'];
          break;
        case 'RETRYING':
          jobTypes = ['repeat'];
          break;
        case 'FAILED':
          jobTypes = ['failed'];
          break;
        case 'CANCELLED':
          jobTypes = ['failed'];
          break;
      }
    }
    const settledFilter = options?.filter?.isSettled;
    if (settledFilter?.eq != null) {
      jobTypes = settledFilter.eq
        ? ['completed', 'failed']
        : ['wait', 'waiting-children', 'active', 'repeat', 'delayed', 'paused'];
    }

    let items: Bull.Job[] = [];
    let totalItems = 0;

    try {
      const [total, jobIds] = await this.callCustomScript(getJobsByType, [
        skip,
        take,
        options?.filter?.queueName?.eq ?? '',
        ...jobTypes,
      ]);
      items = (
        await Promise.all(
          jobIds.map((id: string) => {
            return BullJob.fromId(this.queue, id);
          }),
        )
      ).filter(notNullOrUndefined);
      totalItems = total;
    } catch (e) {
      throw new BErrors.InternalServerError(e.message);
    }

    return {
      items: await Promise.all(items.map(bullJob => this.createJoborJob(bullJob))),
      totalItems,
    };
  }

  async findManyById(ids: ID[]): Promise<Job[]> {
    const bullJobs = await Promise.all(ids.map(id => this.queue.getJob(id.toString())));
    return Promise.all(bullJobs.filter(notNullOrUndefined).map(j => this.createJoborJob(j)));
  }

  async findOne(id: ID): Promise<Job | undefined> {
    const bullJob = await this.queue.getJob(id.toString());
    if (bullJob) {
      return this.createJoborJob(bullJob);
    }
  }

  // TODO V2: actually make it use the olderThan parameter
  async removeSettledJobs(queueNames?: string[], olderThan?: Date): Promise<number> {
    try {
      const jobCounts = await this.queue.getJobCounts('completed', 'failed');
      await this.queue.clean(100, 0, 'completed');
      await this.queue.clean(100, 0, 'failed');
      return Object.values(jobCounts).reduce((sum, num) => sum + num, 0);
    } catch (e) {
      Logger.error(e.message, loggerCtx, e.stack);
      return 0;
    }
  }

  async start<Data extends JobData<Data> = object>(
    queueName: string,
    process: (job: Job<Data>) => Promise<any>,
  ): Promise<void> {
    this.queueNameProcessFnMap.set(queueName, process);
    if (!this.worker) {
      const options: WorkerOptions = {
        concurrency: DEFAULT_CONCURRENCY,
        ...this.options.workerOptions,
        connection: this.redisConnection,
      };
      this.worker = new Worker(QUEUE_NAME, this.workerProcessor, options)
        .on('error', e => Logger.error(`BullMQ Worker error: ${e.message}`, loggerCtx, e.stack))
        .on('closing', e => Logger.verbose(`BullMQ Worker closing: ${e}`, loggerCtx))
        .on('closed', () => Logger.verbose('BullMQ Worker closed'))
        .on('failed', (job: Bull.Job | undefined, error) => {
          Logger.warn(
            `Job ${job?.id ?? '(unknown id)'} [${job?.name ?? 'unknown name'}] failed (attempt ${
              job?.attemptsMade ?? 'unknown'
            } of ${job?.opts.attempts ?? 1})`,
          );
        })
        .on('stalled', (jobId: string) => {
          Logger.warn(`BullMQ Worker: job ${jobId} stalled`, loggerCtx);
        })
        .on('completed', (job: Bull.Job) => {
          Logger.debug(`Job ${job?.id ?? 'unknown id'} [${job.name}] completed`);
        });
    }
  }

  async stop<Data extends JobData<Data> = object>(
    queueName: string,
    process: (job: Job<Data>) => Promise<any>,
  ): Promise<void> {
    if (!this.stopped) {
      this.stopped = true;
      await this.close();
    }
  }

  private async close() {
    try {
      await Promise.all([this.queue.close(), this.worker?.close(true)]);
    } catch (e) {
      Logger.error(e, loggerCtx, e.stack);
    }
  }

  private async createJoborJob(bullJob: Bull.Job): Promise<Job> {
    const jobJson = bullJob.toJSON();
    const state = await this.getState(bullJob);
    return new Job({
      queueName: bullJob.name,
      id: bullJob.id,
      state,
      data: bullJob.data,
      attempts: bullJob.attemptsMade,
      createdAt: new Date(jobJson.timestamp),
      startedAt: jobJson.processedOn ? new Date(jobJson.processedOn) : undefined,
      settledAt: jobJson.finishedOn ? new Date(jobJson.finishedOn) : undefined,
      error: jobJson.failedReason,
      progress: +jobJson.progress,
      result: jobJson.returnvalue,
      retries: bullJob.opts.attempts ? bullJob.opts.attempts - 1 : 0,
    });
  }

  private async getState(bullJob: Bull.Job): Promise<JobState> {
    const jobJson = bullJob.toJSON();

    if ((await bullJob.isWaiting()) || (await bullJob.isWaitingChildren())) {
      return JobState.PENDING;
    }
    if (await bullJob.isActive()) {
      return JobState.RUNNING;
    }
    if (await bullJob.isDelayed()) {
      return JobState.RETRYING;
    }
    if (await bullJob.isFailed()) {
      return JobState.FAILED;
    }
    if (await bullJob.isCompleted()) {
      return JobState.COMPLETED;
    }
    if (!jobJson.finishedOn) {
      return JobState.CANCELLED;
    }
    throw new BErrors.InternalServerError('Could not determine job state');
    // TODO: how to handle "cancelled" state? Currently when we cancel a job, we simply remove all record of it.
  }

  private callCustomScript<T, Args extends any[]>(scriptDef: CustomScriptDefinition<T, Args>, args: Args): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      (this.redisConnection as any)[scriptDef.name](`bull:${this.queue.name}:`, ...args, (err: any, result: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  private defineCustomLuaScripts() {
    const redis = this.redisConnection;
    redis.defineCommand(getJobsByType.name, {
      numberOfKeys: getJobsByType.numberOfKeys,
      lua: getJobsByType.script,
    });
  }
}
