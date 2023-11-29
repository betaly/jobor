import {Job} from '../job';
import {JobBufStore} from '../job-buf-store';

/**
 * @description
 * A {@link JobBufStore} which keeps the buffered jobs in memory. Should
 * _not_ be used in production, since it will lose data in the event of the server
 * stopping.
 *

 * @docsCategory JobQueue
 */
export class InMemoryJobBufStore implements JobBufStore {
  protected map = new Map<string, Set<Job>>();

  async add(bufferId: string, job: Job): Promise<Job> {
    const set = this.getSet(bufferId);
    set.add(job);
    return job;
  }

  async bufferSize(bufferIds?: string[]): Promise<{[bufferId: string]: number}> {
    const ids = bufferIds ?? Array.from(this.map.keys());
    const result: {[bufferId: string]: number} = {};
    for (const id of ids) {
      const size = this.map.get(id)?.size ?? 0;
      result[id] = size;
    }
    return result;
  }

  async flush(bufferIds?: string[]): Promise<{[bufferId: string]: Job[]}> {
    const ids = bufferIds ?? Array.from(this.map.keys());
    const result: {[processorId: string]: Job[]} = {};
    for (const id of ids) {
      const jobs = Array.from(this.map.get(id) ?? []);
      this.map.get(id)?.clear();
      result[id] = jobs;
    }
    return result;
  }

  private getSet(bufferId: string): Set<Job> {
    const set = this.map.get(bufferId);
    if (set) {
      return set;
    } else {
      const newSet = new Set<Job>();
      this.map.set(bufferId, newSet);
      return newSet;
    }
  }
}
