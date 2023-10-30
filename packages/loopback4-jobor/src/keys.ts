import {BindingKey} from '@loopback/core';
import {Jobor, JoborOptions} from 'jobor';

export namespace JoborBindings {
  export const JOBOR_CONFIG = BindingKey.create<JoborOptions>('jobor.config');
  export const JOBOR = BindingKey.create<Jobor>('jobor');
}
