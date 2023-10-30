import {JobType} from 'bullmq';

export const loggerCtx = 'JoborBullMQJobQueue';

export const ALL_JOB_TYPES: JobType[] = [
  'completed',
  'failed',
  'delayed',
  'repeat',
  'waiting-children',
  'active',
  'wait',
  'paused',
];
