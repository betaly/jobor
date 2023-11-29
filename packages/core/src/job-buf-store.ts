import {Job} from './job';

/**
 * @description
 * This strategy defines where to store jobs that have been collected by a
 * {@link JobBuffer}.
 *

 * @docsCategory job-queue
 */
export interface JobBufStore {
  /**
   * @description
   * Persist a job to the bufstore medium. The bufstore format should
   * take into account the `bufferId` argument, as it is necessary to be
   * able to later retrieve jobs by that id.
   */
  add(bufferId: string, job: Job): Promise<Job>;

  /**
   * @description
   * Returns an object containing the number of buffered jobs arranged by bufferId.
   *
   * Passing bufferIds limits the results to the specified bufferIds.
   * If the array is empty, sizes will be returned for _all_ bufferIds.
   *
   * @example
   * ```ts
   * const sizes = await myJobBufferStrategy.bufferSize(['buffer-1', 'buffer-2']);
   *
   * // sizes = { 'buffer-1': 12, 'buffer-2': 3 }
   * ```
   */
  bufferSize(bufferIds?: string[]): Promise<{[bufferId: string]: number}>;

  /**
   * @description
   * Clears all jobs from the bufstore medium which match the specified bufferIds (if the
   * array is empty, clear for _all_ bufferIds), and returns those jobs in an object
   * arranged by bufferId
   *
   * @example
   * ```ts
   * const result = await myJobBufferStrategy.flush(['buffer-1', 'buffer-2']);
   *
   * // result = {
   * //   'buffer-1': [Job, Job, Job, ...],
   * //   'buffer-2': [Job, Job, Job, ...],
   * // };
   * ```
   */
  flush(bufferIds?: string[]): Promise<{[bufferId: string]: Job[]}>;
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isJobBufStore(x: any): x is JobBufStore {
  return x && typeof x.add === 'function' && typeof x.bufferSize === 'function' && typeof x.flush === 'function';
}
