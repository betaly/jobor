/* eslint-disable @typescript-eslint/no-explicit-any */

import {DockerComposeManager} from 'dockerlab';
import path from 'path';

export default async () => {
  // skip in CI
  if (process.env.CI) {
    return;
  }
  const manager = ((globalThis as any).dcm = new DockerComposeManager(
    'default',
    path.resolve(__dirname, '.dockerlab'),
  ));
  await manager.up(['redis'], {}, {log: true});
};
