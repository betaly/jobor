import {Job, JobBufStore, JobConfig, Logger} from '@jobor/core';
import {Cluster, Redis, RedisOptions} from 'ioredis';
import superjson from 'superjson';
import {AnyObj} from 'tily/typings/types';

import {loggerCtx} from './constants';

const BUFFER_LIST_PREFIX = 'jobor-job-buffer';

export type RedisConnectionOptions = Redis | Cluster | RedisOptions;

export type RedisJobBufStoreOptions =
  | RedisConnectionOptions
  | {
      connection: Redis | Cluster | RedisOptions;
    };

export class RedisJobBufStore implements JobBufStore {
  readonly client: Redis | Cluster;

  constructor(options?: RedisJobBufStoreOptions) {
    options = options ?? {};
    const connection = (options as AnyObj).connection ? (options as AnyObj).connection : options;
    if (connection instanceof Redis) {
      this.client = connection;
    } else if (connection instanceof Cluster) {
      this.client = connection;
    } else {
      this.client = new Redis({
        host: 'localhost',
        port: 6379,
        maxRetriesPerRequest: null,
        ...connection,
      } as RedisOptions);
    }
    (this.client as AnyObj).maxRetriesPerRequest = null;
  }

  async add(bufferId: string, job: Job): Promise<Job> {
    await this.client.lpush(this.keyName(bufferId), this.toJobConfigString(job));
    return job;
  }

  async bufferSize(bufferIds?: string[]): Promise<{[bufferId: string]: number}> {
    const ids = bufferIds?.length ? bufferIds : await this.getAllBufferIds();
    const result: {[bufferId: string]: number} = {};
    for (const id of ids || []) {
      const key = this.keyName(id);
      result[id] = await this.client.llen(key);
    }
    return result;
  }

  async flush(bufferIds?: string[]): Promise<{[bufferId: string]: Job[]}> {
    const ids = bufferIds?.length ? bufferIds : await this.getAllBufferIds();
    const result: {[bufferId: string]: Job[]} = {};
    for (const id of ids) {
      const key = this.keyName(id);
      const items = await this.client.lrange(key, 0, -1);
      await this.client.del(key);
      result[id] = items.map(item => this.toJob(item));
    }
    return result;
  }

  private keyName(bufferId: string) {
    return `${BUFFER_LIST_PREFIX}:${bufferId}`;
  }

  private toJobConfigString(job: Job): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobConfig: JobConfig<any> = {
      ...job,
      data: job.data,
      id: job.id ?? undefined,
    };
    return superjson.stringify(jobConfig);
  }

  private toJob(jobConfigString: string): Job {
    try {
      // TODO parse date strings
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jobConfig: JobConfig<any> = superjson.parse(jobConfigString);
      return new Job(jobConfig);
    } catch (e) {
      Logger.error(`Could not parse buffered job:\n${JSON.stringify(e.message)}`, loggerCtx, e.stack);
      throw e;
    }
  }

  private async getAllBufferIds(): Promise<string[]> {
    const stream =
      this.client instanceof Redis
        ? this.client.scanStream({
            match: `${BUFFER_LIST_PREFIX}:*`,
          })
        : this.client.nodes()[0].scanStream({
            match: `${BUFFER_LIST_PREFIX}:*`,
          });
    const keys = await new Promise<string[]>((resolve, reject) => {
      const allKeys: string[] = [];
      stream.on('data', _keys => allKeys.push(..._keys));
      stream.on('end', () => resolve(allKeys));
      stream.on('error', err => reject(err));
    });

    return keys.map(key => key.replace(`${BUFFER_LIST_PREFIX}:`, ''));
  }
}
