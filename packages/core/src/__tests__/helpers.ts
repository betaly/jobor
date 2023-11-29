import {InMemoryJobBufStore} from '../bufstores/in-memory-job-bufstore';
import {Job} from '../job';

/**
 * This strategy is only intended to be used for automated testing.
 */
export class TestingJobBufStoreStrategy extends InMemoryJobBufStore {
  getBufferedJobs(bufferId: string): Job[] {
    return Array.from(this.map.get(bufferId) ?? []);
  }
}
