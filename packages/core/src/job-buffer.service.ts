import {BErrors} from 'berrors';
import sortBy from 'tily/array/sortBy';

import {AnyJob, Job} from './job';
import {JobBufStore} from './job-buf-store';
import {AnyJobBuffer, JobBuffer} from './job-buffer';
import {JobQueueOptions} from './job-queue.service';
import {JobQueueAdapter} from './job-queue-adapter';
import {Logger} from './logger';

/**
 * @description
 * Used to manage {@link JobBuffer}s.Primarily intended to be used internally by the {@link JobQueueService}, which
 * exposes its public-facing functionality.
 */
export class JobBufferService {
  protected buffers = new Set<JobBuffer>();
  protected adapter: JobQueueAdapter;
  protected bufstore: JobBufStore;

  constructor(private options: JobQueueOptions) {
    this.adapter = this.options.adapter;
    this.bufstore = this.options.bufstore;
  }

  addBuffer(buffer: AnyJobBuffer) {
    const idAlreadyExists = Array.from(this.buffers).find(p => p.id === buffer.id);
    if (idAlreadyExists) {
      throw new BErrors.InternalServerError(
        `There is already a JobBufferProcessor with the id "${buffer.id}". Ids must be unique`,
      );
    }
    this.buffers.add(buffer);
  }

  removeBuffer(buffer: AnyJobBuffer) {
    this.buffers.delete(buffer);
  }

  async add(job: AnyJob): Promise<boolean> {
    let collected = false;
    for (const buffer of this.buffers) {
      const shouldCollect = await buffer.collect(job);
      if (shouldCollect) {
        collected = true;
        await this.bufstore.add(buffer.id, job);
      }
    }
    return collected;
  }

  bufferSize(forBuffers?: Array<JobBuffer | string>): Promise<{[bufferId: string]: number}> {
    const buffer = forBuffers ?? Array.from(this.buffers);
    return this.bufstore.bufferSize(buffer.map(p => (typeof p === 'string' ? p : p.id)));
  }

  async flush(forBuffers?: Array<JobBuffer | string>): Promise<Job[]> {
    const {adapter} = this;
    const buffers = forBuffers ?? Array.from(this.buffers);
    const ids = buffers.map(p => (typeof p === 'string' ? p : p.id));
    const flushResult = await this.bufstore.flush(ids);
    const result: Job[] = [];
    for (const buffer of this.buffers) {
      const jobsForBuffer = sortBy(job => job.createdAt, flushResult[buffer.id]);
      if (jobsForBuffer?.length) {
        let jobsToAdd = jobsForBuffer;
        try {
          jobsToAdd = await buffer.reduce(jobsForBuffer);
        } catch (e) {
          Logger.error(
            `Error encountered processing jobs in JobBuffer "${buffer.id}":\n${JSON.stringify(e.message)}`,
            undefined,
            e.stack,
          );
        }
        for (const job of jobsToAdd) {
          result.push(await adapter.add(job));
        }
      }
    }
    return result;
  }
}
