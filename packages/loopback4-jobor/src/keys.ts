import {BindingKey} from '@loopback/core';
import {Jobor} from 'jobor';

import {JoborComponent} from './component';
import {JoborConfig} from './types';

export namespace JoborBindings {
  export const COMPONENT = BindingKey.create<JoborComponent>('components.JoborComponent');
  export const CONFIG = BindingKey.create<JoborConfig>('jobor.config');
  export const JOBOR = BindingKey.create<Jobor>('jobor');
}
