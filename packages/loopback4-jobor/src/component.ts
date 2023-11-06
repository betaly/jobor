import {Application, Component, config, ContextTags, CoreBindings, inject, injectable} from '@loopback/core';

import {JoborBindings} from './keys';
import {JoborWorkerObserver} from './observers';
import {JoborProvider} from './providers';
import {JoborComponentConfig} from './types';

@injectable({tags: {[ContextTags.KEY]: JoborBindings.COMPONENT}})
export class JoborComponent implements Component {
  providers = {
    [JoborBindings.JOBOR.key]: JoborProvider,
  };

  constructor(
    @inject(CoreBindings.APPLICATION_INSTANCE)
    app: Application,
    @config()
    cfg: JoborComponentConfig = {},
  ) {
    if (cfg.startWorker) {
      app.lifeCycleObserver(JoborWorkerObserver);
    }
  }
}
