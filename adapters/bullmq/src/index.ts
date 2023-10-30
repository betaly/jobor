// ensure that the bullmq package is installed
import {BullMQJobQueueAdapter} from './bullmq-job-queue-adapter';

try {
  require('bullmq');
} catch (e) {
  console.error('The BullMQJobQueueStrategy depends on the "bullmq" package being installed.');
  process.exit(1);
}

export * from './bullmq-job-queue-adapter';
export * from './redis-health-indicator';
export * from './types';

export default BullMQJobQueueAdapter;
