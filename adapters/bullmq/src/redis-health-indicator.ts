import {HealthIndicator, HealthIndicatorResult, Logger} from '@jobor/core';
import {RedisConnection} from 'bullmq';
import {delay} from 'tily/delay';

import {loggerCtx} from './constants';
import {BullMQPAdapterOptions} from './types';

class HealthCheckError extends Error {
  constructor(
    public message: string,
    public healthIndicatorResult: HealthIndicatorResult,
  ) {
    super(message);
  }
}

export class RedisHealthIndicator extends HealthIndicator {
  private timeoutTimer: NodeJS.Timeout | undefined;

  constructor(private options: BullMQPAdapterOptions) {
    super();
  }

  async isHealthy(key: string, timeoutMs = 5000): Promise<HealthIndicatorResult> {
    const connection = new RedisConnection(this.options.connection);
    // eslint-disable-next-line @typescript-eslint/no-misused-promises,no-async-promise-executor
    const pingResult = await new Promise<string | Error>(async resolve => {
      try {
        connection.on('error', err => {
          Logger.error(`Redis health check error: ${JSON.stringify(err.message)}`, loggerCtx, err.stack);
          resolve(err);
        });
        if (this.timeoutTimer) {
          clearTimeout(this.timeoutTimer);
        }
        const client = await Promise.race([connection.client, delay(timeoutMs)]);
        clearTimeout(this.timeoutTimer);
        if (!client) {
          resolve(new Error('timeout'));
          return;
        }
        // eslint-disable-next-line no-void
        void client.ping((err, res) => {
          if (err) {
            resolve(err);
          } else if (res) {
            resolve(res);
          } else {
            resolve(new Error('Redis health check error: no response'));
          }
        });
      } catch (e) {
        resolve(e);
      }
    });

    try {
      await connection.close();
    } catch (e) {
      Logger.error(`Redis health check error closing connection: ${JSON.stringify(e.message)}`, loggerCtx, e.stack);
    }

    const result = this.getStatus(key, pingResult === 'PONG');

    if (pingResult === 'PONG') {
      return result;
    }
    throw new HealthCheckError('Redis failed', result);
  }
}
