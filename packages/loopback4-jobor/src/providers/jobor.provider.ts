import {inject, Provider} from '@loopback/core';
import {Jobor, JoborOptions} from 'jobor';

import {JoborBindings} from '../keys';

export class JoborProvider implements Provider<Jobor> {
  protected jobor: Jobor;

  constructor(@inject(JoborBindings.JOBOR_CONFIG) private config: JoborOptions) {}

  value(): Jobor {
    if (!this.jobor) {
      this.jobor = new Jobor(this.config);
    }
    return this.jobor;
  }
}
