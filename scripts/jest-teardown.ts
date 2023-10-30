/* eslint-disable @typescript-eslint/no-explicit-any */
import {DockerComposeManager} from 'dockerlab';

export default async () => {
  // skip in CI
  if (process.env.CI) {
    return;
  }
  const manager = (globalThis as any).dcm as DockerComposeManager;
  await manager.down();
};
