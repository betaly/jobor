import {
  InMemoryJobBufStore,
  InMemoryJobQueueAdapter,
  InMemoryJobQueueAdapterOptions,
  isJobBufStore,
  isJobQueueAdapter,
  JobBufStore,
  JobQueueAdapter,
  JobQueueOptions,
  JobQueueService,
  ProcessContext,
  ProcessMode,
} from '@jobor/core';

export interface JobQueueAdapterOptions {
  name?: 'memory' | 'bullmq';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface JobBufStoreOptions {
  name?: 'memory' | 'redis';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface JoborOptions extends Omit<JobQueueOptions, 'adapter' | 'bufstore'> {
  adapter?: JobQueueAdapter | JobQueueAdapterOptions;
  bufstore?: JobBufStore | JobBufStoreOptions;
  processMode?: ProcessMode;
}

export class Jobor extends JobQueueService {
  readonly processContext: ProcessContext;

  constructor(options?: JoborOptions) {
    const {adapter: adapterOrOptions, bufstore: storageOrOptions, processMode, ...rest} = options ?? {};

    const adapter = isJobQueueAdapter(adapterOrOptions)
      ? adapterOrOptions
      : loadAdapter({processMode, ...adapterOrOptions});
    const bufstore = isJobBufStore(storageOrOptions)
      ? storageOrOptions
      : loadStorage({processMode, ...storageOrOptions});
    super({
      ...rest,
      adapter,
      bufstore: bufstore,
    });

    this.processContext = new ProcessContext(processMode);
  }
}

export const loadAdapter = (options?: JobQueueAdapterOptions) => {
  const adapters = {
    bullmq: '@jobor/bullmq',
  };

  const name = options?.name || 'memory';
  if (name === 'memory') {
    return new InMemoryJobQueueAdapter(options as InMemoryJobQueueAdapterOptions);
  }

  if (!adapters[name]) {
    throw new Error(`Adapter ${name} is not allowed`);
  }

  const mod = require(adapters[name]);
  return new (mod.default ?? mod)(options) as JobQueueAdapter;
};

export const loadStorage = (options?: JobBufStoreOptions) => {
  const bufstores = {
    redis: '@jobor/bufstore-redis',
  };

  const name = options?.name || 'memory';
  if (name === 'memory') {
    return new InMemoryJobBufStore();
  }

  if (!bufstores[name]) {
    throw new Error(`Storage ${name} is not allowed`);
  }

  const mod = require(bufstores[name]);
  return new (mod.default ?? mod)(options) as JobBufStore;
};
