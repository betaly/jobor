import {BindingScope, inject, injectable, Provider} from '@loopback/core';
import {Jobor} from 'jobor';

import {JoborBindings} from '../keys';
import {JoborConfig} from '../types';

@injectable({scope: BindingScope.SINGLETON})
export class JoborProvider implements Provider<Jobor> {
  protected jobor: Jobor;

  constructor(
    @inject(JoborBindings.CONFIG, {optional: true})
    private config: JoborConfig = {},
  ) {}

  value(): Jobor {
    if (!this.jobor) {
      this.jobor = new Jobor(this.config);
    }
    return this.jobor;
  }
}
