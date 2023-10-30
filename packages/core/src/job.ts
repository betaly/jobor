import {AnyObj} from 'tily/typings/types';

import {Logger} from './logger';
import {JobConfig, JobData, JobState} from './types';
import {isClassInstance, isObject} from './utils';

/**
 * @description
 * An event raised by a Job.
 *
 * @docsCategory JobQueue
 * @docsPage Job
 */
export type JobEventType = 'progress';

/**
 * @description
 * The signature of the event handler expected by the `Job.on()` method.
 *
 * @docsCategory JobQueue
 * @docsPage Job
 */
export type JobEventListener<T extends JobData<T>> = (job: Job<T>) => void;

/**
 * @description
 * A Job represents a piece of work to be run in the background, i.e. outside the request-response cycle.
 * It is intended to be used for long-running work triggered by API requests. Jobs should now generally
 * be directly instantiated. Rather, the {@link JobQueue} `add()` method should be used to create and
 * add a new Job to a queue.
 *
 * @docsCategory JobQueue
 * @docsPage Job
 * @docsWeight 0
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Job<T extends JobData<T> = any> {
  readonly id: number | string | null;
  readonly queueName: string;
  readonly retries: number;
  readonly createdAt: Date;
  private readonly _data: T;
  private readonly eventListeners: {[type in JobEventType]: Array<JobEventListener<T>>} = {
    progress: [],
  };

  constructor(config: JobConfig<T>) {
    this.queueName = config.queueName;
    this._data = this.ensureDataIsSerializable(config.data) as T;
    this.id = config.id || null;
    this._state = config.state || JobState.PENDING;
    this.retries = config.retries || 0;
    this._attempts = config.attempts || 0;
    this._progress = config.progress || 0;
    this.createdAt = config.createdAt || new Date();
    this._result = config.result;
    this._error = config.error;
    this._startedAt = config.startedAt;
    this._settledAt = config.settledAt;
  }

  private _state: JobState;

  get state(): JobState {
    return this._state;
  }

  private _progress: number;

  get progress(): number {
    return this._progress;
  }

  private _result?: unknown;

  get result() {
    return this._result;
  }

  private _error?: string;

  get error() {
    return this._error;
  }

  private _attempts: number;

  get attempts(): number {
    return this._attempts;
  }

  private _startedAt?: Date;

  get startedAt(): Date | undefined {
    return this._startedAt;
  }

  private _settledAt?: Date;

  get settledAt(): Date | undefined {
    return this._settledAt;
  }

  get name(): string {
    return this.queueName;
  }

  get data(): T {
    return this._data;
  }

  get isSettled(): boolean {
    return (
      !!this._settledAt &&
      (this._state === JobState.COMPLETED || this._state === JobState.FAILED || this._state === JobState.CANCELLED)
    );
  }

  get duration(): number {
    if (this.state === JobState.PENDING || this.state === JobState.RETRYING) {
      return 0;
    }
    const end = this._settledAt || new Date();
    return +end - +(this._startedAt || end);
  }

  /**
   * @description
   * Calling this signifies that the job work has started. This method should be
   * called in the {@link JobQueueAdapter} `next()` method.
   */
  start() {
    if (this._state === JobState.PENDING || this._state === JobState.RETRYING) {
      this._state = JobState.RUNNING;
      this._startedAt = new Date();
      this._attempts++;
      Logger.debug(
        `Job ${this.id?.toString() ?? 'null'} [${this.queueName}] starting (attempt ${this._attempts} of ${
          this.retries + 1
        })`,
      );
    }
  }

  /**
   * @description
   * Sets the progress (0 - 100) of the job.
   */
  setProgress(percent: number) {
    this._progress = Math.max(0, Math.min(percent, 100));
    this.fireEvent('progress');
  }

  /**
   * @description
   * Calling this method signifies that the job succeeded. The result
   * will be stored in the `Job.result` property.
   */
  complete(result?: unknown) {
    this._result = result;
    this._progress = 100;
    this._state = JobState.COMPLETED;
    this._settledAt = new Date();
    Logger.debug(`Job ${this.id?.toString() ?? 'null'} [${this.queueName}] completed`);
  }

  /**
   * @description
   * Calling this method signifies that the job failed.
   */
  fail(err?: unknown) {
    this._error = isObject(err) ? err?.message ?? String(err) : String(err);
    this._progress = 0;
    if (this.retries >= this._attempts) {
      this._state = JobState.RETRYING;
      Logger.warn(
        `Job ${this.id?.toString() ?? 'null'} [${this.queueName}] failed (attempt ${this._attempts} of ${
          this.retries + 1
        })`,
      );
    } else {
      if (this._state !== JobState.CANCELLED) {
        this._state = JobState.FAILED;
        Logger.warn(`Job ${this.id?.toString() ?? 'null'} [${this.queueName}] failed and will not retry.`);
      }
      this._settledAt = new Date();
    }
  }

  cancel() {
    this._settledAt = new Date();
    this._state = JobState.CANCELLED;
  }

  /**
   * @description
   * Sets a RUNNING job back to PENDING. Should be used when the JobQueue is being
   * destroyed before the job has been completed.
   */
  defer() {
    if (this._state === JobState.RUNNING) {
      this._state = JobState.PENDING;
      this._attempts = 0;
      Logger.debug(`Job ${this.id?.toString() ?? 'null'} [${this.queueName}] deferred back to PENDING state`);
    }
  }

  /**
   * @description
   * Used to register event handlers for job events
   */
  on(eventType: JobEventType, listener: JobEventListener<T>) {
    this.eventListeners[eventType].push(listener);
  }

  off(eventType: JobEventType, listener: JobEventListener<T>) {
    const idx = this.eventListeners[eventType].indexOf(listener);
    if (idx !== -1) {
      this.eventListeners[eventType].splice(idx, 1);
    }
  }

  private fireEvent(eventType: JobEventType) {
    for (const listener of this.eventListeners[eventType]) {
      listener(this);
    }
  }

  /**
   * All data in a job must be serializable. This method handles certain problem cases such as when
   * the data is a class instance with getters. Even though technically the "data" object should
   * already be serializable per the TS type, in practice data can slip through due to loss of
   * type safety.
   */
  private ensureDataIsSerializable(data: unknown, depth = 0): unknown {
    if (10 < depth) {
      return '[max depth reached]';
    }
    depth++;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let output: any;
    if (data instanceof Date) {
      return data.toISOString();
    } else if (isObject(data)) {
      output = {} as AnyObj;
      for (const key of Object.keys(data)) {
        output![key] = this.ensureDataIsSerializable(data[key], depth);
      }
      if (isClassInstance(data)) {
        const descriptors = Object.getOwnPropertyDescriptors(Object.getPrototypeOf(data));
        for (const name of Object.keys(descriptors)) {
          const descriptor = descriptors[name];
          if (typeof descriptor.get === 'function') {
            output![name] = (data as AnyObj)[name];
          }
        }
      }
    } else if (Array.isArray(data)) {
      output = [] as Array<T | string>;
      data.forEach((item, i) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (output as any[])[i] = this.ensureDataIsSerializable(item, depth);
      });
    } else {
      return data;
    }
    return output;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyJob = Job<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AnyJob = Job<any>;
