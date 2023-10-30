/* eslint-disable @typescript-eslint/no-explicit-any */

import {Job} from '../job';
import {AnyPromise, ID, InputMaybe, JsonCompatible, Scalars} from './common';
import {BooleanOperators, DateOperators, IdOperators, NumberOperators, StringOperators} from './ops';
import {LogicalOperator, SortOrder} from './query';

/**
 * @description
 * The state of a Job in the JobQueue
 *
 * @docsCategory common
 */
export enum JobState {
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
  RETRYING = 'RETRYING',
  RUNNING = 'RUNNING',
}

/**
 * @description
 * Used to configure a new {@link JobQueue} instance.
 *
 * @docsCategory JobQueue
 * @docsPage types
 */
export interface CreateQueueOptions<T extends JobData<T>> {
  /**
   * @description
   * The name of the queue, e.g. "image processing", "re-indexing" etc.
   */
  name: string;
  /**
   * @description
   * Defines the work to be done for each job in the queue. The returned promise
   * should resolve when the job is complete, or be rejected in case of an error.
   */
  process: (job: Job<T>) => AnyPromise;
}

/**
 * @description
 * A JSON-serializable data type which provides a {@link Job}
 * with the data it needs to be processed.
 *
 * @docsCategory JobQueue
 * @docsPage types
 */
export type JobData<T> = JsonCompatible<T>;

/**
 * @description
 * Used to instantiate a new {@link Job}
 *
 * @docsCategory JobQueue
 * @docsPage types
 */
export interface JobConfig<T extends JobData<T>> {
  queueName: string;
  data: T;
  retries?: number;
  attempts?: number;
  id?: ID;
  state?: JobState;
  progress?: number;
  result?: any;
  error?: any;
  createdAt?: Date;
  startedAt?: Date;
  settledAt?: Date;
}

export type JobFilterParameter = {
  attempts?: InputMaybe<NumberOperators>;
  createdAt?: InputMaybe<DateOperators>;
  duration?: InputMaybe<NumberOperators>;
  id?: InputMaybe<IdOperators>;
  isSettled?: InputMaybe<BooleanOperators>;
  progress?: InputMaybe<NumberOperators>;
  queueName?: InputMaybe<StringOperators>;
  retries?: InputMaybe<NumberOperators>;
  settledAt?: InputMaybe<DateOperators>;
  startedAt?: InputMaybe<DateOperators>;
  state?: InputMaybe<StringOperators>;
};

export type JobSortParameter = {
  attempts?: InputMaybe<SortOrder>;
  createdAt?: InputMaybe<SortOrder>;
  duration?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  progress?: InputMaybe<SortOrder>;
  queueName?: InputMaybe<SortOrder>;
  retries?: InputMaybe<SortOrder>;
  settledAt?: InputMaybe<SortOrder>;
  startedAt?: InputMaybe<SortOrder>;
};

export type JobListOptions = {
  /** Allows the results to be filtered */
  filter?: InputMaybe<JobFilterParameter>;
  /** Specifies whether multiple "filter" arguments should be combines with a logical AND or OR operation. Defaults to AND. */
  filterOperator?: InputMaybe<LogicalOperator>;
  /** Skips the first n results, for use in pagination */
  skip?: InputMaybe<Scalars['Int']['input']>;
  /** Specifies which properties to sort the results by */
  sort?: InputMaybe<JobSortParameter>;
  /** Takes n results, for use in pagination */
  take?: InputMaybe<Scalars['Int']['input']>;
};

export interface JobQueueStatus {
  name: string;
  running: boolean;
}
