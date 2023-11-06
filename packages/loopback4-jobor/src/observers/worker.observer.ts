import {inject, LifeCycleObserver} from '@loopback/core';
import {Jobor} from 'jobor';

import {JoborBindings} from '../keys';

export class JoborWorkerObserver implements LifeCycleObserver {
  constructor(
    @inject(JoborBindings.JOBOR)
    private jobor: Jobor,
  ) {}

  async start(): Promise<void> {
    await this.jobor.start();
  }

  async stop(): Promise<void> {
    await this.jobor.stop();
  }
}
