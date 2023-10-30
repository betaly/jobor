import {InMemoryJobQueueAdapter} from './adapters/in-memory-job-queue-adapter';
import {Job} from './job';

/**
 * @description
 * An in-memory {@link JobQueueAdapter} design for testing purposes.
 */
export class TestingJobQueueStrategy extends InMemoryJobQueueAdapter {
  async prePopulate(jobs: Job[]) {
    for (const job of jobs) {
      await this.add(job);
    }
  }
}
