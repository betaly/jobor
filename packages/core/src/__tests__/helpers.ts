import {Job} from '../job';
import {InMemoryJobBufferStorage} from '../storages/in-memory-job-buffer-storage';

/**
 * This strategy is only intended to be used for automated testing.
 */
export class TestingJobBufferStorageStrategy extends InMemoryJobBufferStorage {
  getBufferedJobs(bufferId: string): Job[] {
    return Array.from(this.bufferStorage.get(bufferId) ?? []);
  }
}
