import {
  InMemoryJobBufferStorage,
  InMemoryJobQueueAdapter,
  InMemoryJobQueueAdapterOptions,
  isJobBufferStorage,
  isJobQueueAdapter,
  JobBufferStorage,
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

export interface JobBufferStorageOptions {
  name?: 'memory' | 'redis';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface JoborOptions extends Omit<JobQueueOptions, 'adapter' | 'storage'> {
  adapter?: JobQueueAdapter | JobQueueAdapterOptions;
  storage?: JobBufferStorage | JobBufferStorageOptions;
  processMode?: ProcessMode;
}

export class Jobor extends JobQueueService {
  readonly processContext: ProcessContext;

  constructor(options?: JoborOptions) {
    const {adapter: adapterOrOptions, storage: storageOrOptions, processMode, ...rest} = options ?? {};

    const adapter = isJobQueueAdapter(adapterOrOptions)
      ? adapterOrOptions
      : loadAdapter({processMode, ...adapterOrOptions});
    const storage = isJobBufferStorage(storageOrOptions)
      ? storageOrOptions
      : loadStorage({processMode, ...storageOrOptions});
    super({
      ...rest,
      adapter,
      storage,
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

export const loadStorage = (options?: JobBufferStorageOptions) => {
  const storages = {
    redis: '@jobor/storage-redis',
  };

  const name = options?.name || 'memory';
  if (name === 'memory') {
    return new InMemoryJobBufferStorage();
  }

  if (!storages[name]) {
    throw new Error(`Storage ${name} is not allowed`);
  }

  const mod = require(storages[name]);
  return new (mod.default ?? mod)(options) as JobBufferStorage;
};
