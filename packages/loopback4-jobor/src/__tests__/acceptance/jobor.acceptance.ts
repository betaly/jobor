import {Application} from '@loopback/core';
import {Jobor} from 'jobor';
import {firstValueFrom, Subject} from 'rxjs';

import {JoborComponent} from '../../component';
import {JoborBindings} from '../../keys';

describe('Jobor', () => {
  let app: Application;
  let jobor: Jobor;

  beforeEach(async () => {
    app = new Application();
    app.bind(JoborBindings.CONFIG).to({
      //
    });
    app.component(JoborComponent);
    await app.start();

    jobor = await app.get(JoborBindings.JOBOR);
    await jobor.start();
  });

  afterEach(async () => {
    await jobor.stop();
    if (app) await app.stop();
    (app as unknown) = undefined;
  });

  it('should work', async () => {
    const subject = new Subject<string>();
    const subNext = firstValueFrom(subject);
    const testQueue = await jobor.createQueue<string>({
      name: 'test',
      process: async job => {
        subject.next(job.data);
      },
    });

    await testQueue.add('hello');
    const data = await subNext;
    expect(data).toBe('hello');
  });
});
