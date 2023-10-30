import {Job} from './job';
import {JobQueueAdapter} from './job-queue-adapter';
import {ID, JobListOptions, PaginatedList} from './types';

/**
 * @description
 * An InspectableJobQueueStrategy is one which allows for the inspection of the jobs
 * which it manages.
 *
 * @docsCategory JobQueue
 */
export interface InspectableJobQueueAdapter extends JobQueueAdapter {
  /**
   * @description
   * Returns a job by its id.
   */
  findOne(id: ID): Promise<Job | undefined>;

  /**
   * @description
   * Returns a list of jobs according to the specified options.
   */
  findMany(options?: JobListOptions): Promise<PaginatedList<Job>>;

  /**
   * @description
   * Returns an array of jobs for the given ids.
   */
  findManyById(ids: ID[]): Promise<Job[]>;

  /**
   * @description
   * Remove all settled jobs in the specified queues older than the given date.
   * If no queueName is passed, all queues will be considered. If no olderThan
   * date is passed, all jobs older than the current time will be removed.
   *
   * Returns a promise of the number of jobs removed.
   */
  removeSettledJobs(queueNames?: string[], olderThan?: Date): Promise<number>;

  cancelJob(jobId: ID): Promise<Job | undefined>;
}

export function isInspectableJobQueueAdapter(adapter: JobQueueAdapter): adapter is InspectableJobQueueAdapter {
  return (
    (adapter as InspectableJobQueueAdapter).findOne !== undefined &&
    (adapter as InspectableJobQueueAdapter).findMany !== undefined &&
    (adapter as InspectableJobQueueAdapter).findManyById !== undefined &&
    (adapter as InspectableJobQueueAdapter).removeSettledJobs !== undefined
  );
}
