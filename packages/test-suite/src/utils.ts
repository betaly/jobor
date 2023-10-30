import {AnyJob, isInspectableJobQueueAdapter, Job, JobQueueAdapter} from '@jobor/core';
import {assert} from 'tily/assert';

export function genName(prefix: string) {
  return `${prefix}-${Math.floor(Math.random() * 100000)}`;
}

export function tick(ms = 0): Promise<void> {
  return new Promise<void>(resolve => {
    if (ms > 0) {
      setTimeout(resolve, ms);
    } else {
      process.nextTick(resolve);
    }
  });
}

export function getJobFromAdapter(adapter: JobQueueAdapter, job: AnyJob | string): Promise<Job> {
  assert(isInspectableJobQueueAdapter(adapter), 'adapter must be InspectableJobQueueAdapter');
  const id = typeof job === 'string' ? job : job.id!;
  return adapter.findOne(id) as Promise<Job>;
}
