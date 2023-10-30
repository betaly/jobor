import {Job} from './job';
import {AnyPromise} from './types';

export class QueueNameProcessStorage<T> {
  private items = new Map<string, Map<(job: Job) => AnyPromise, T>>();

  set(queueName: string, process: (job: Job) => AnyPromise, listener: T) {
    let items = this.items.get(queueName);
    if (!items) {
      items = new Map();
      this.items.set(queueName, items);
    }
    items.set(process, listener);
  }

  has(queueName: string, process: (job: Job) => AnyPromise): boolean {
    const items = this.items.get(queueName);
    if (!items) {
      return false;
    }
    return items.has(process);
  }

  getAndDelete(queueName: string, process: (job: Job) => AnyPromise): T | undefined {
    const items = this.items.get(queueName);
    if (!items) {
      return;
    }
    const item = items.get(process);
    if (!item) {
      return;
    }
    items.delete(process);
    if (items.size === 0) {
      this.items.delete(queueName);
    }
    return item;
  }
}
