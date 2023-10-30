import {Component} from '@loopback/core';

import {JoborBindings} from './keys';
import {JoborProvider} from './providers/jobor.provider';

export class JoborComponent implements Component {
  providers = {
    [JoborBindings.JOBOR.key]: JoborProvider,
  };

  constructor() {}
}
