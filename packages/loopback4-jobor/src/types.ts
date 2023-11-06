import {JoborOptions} from 'jobor';

export interface JoborConfig extends JoborOptions {}

export interface JoborComponentConfig {
  startWorker?: boolean;
}
