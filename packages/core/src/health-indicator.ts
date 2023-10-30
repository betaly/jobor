/* eslint-disable @typescript-eslint/no-explicit-any */
export type HealthIndicatorStatus = 'up' | 'down';
/**
 * The result object of a health indicator
 * @publicApi
 */
export type HealthIndicatorResult = {
  /**
   * The key of the health indicator which should be unique
   */
  [key: string]: {
    /**
     * The status if the given health indicator was successful or not
     */
    status: HealthIndicatorStatus;
    /**
     * Optional settings of the health indicator result
     */
    [optionalKeys: string]: any;
  };
};

/**
 * Represents an abstract health indicator
 * with common functionalities
 *
 * A custom HealthIndicator should inherit the `HealthIndicator` class.
 *
 * ```typescript
 *
 * class MyHealthIndicator extends HealthIndicator {
 *   public check(key: string) {
 *     // Replace with the actual check
 *     const isHealthy = true;
 *     // Returns { [key]: { status: 'up', message: 'Up and running' } }
 *     return super.getStatus(key, isHealthy, { message: 'Up and running' });
 *   }
 * }
 * ```
 *
 * @publicApi
 */
export abstract class HealthIndicator {
  /**
   * Generates the health indicator result object
   * @param key The key which will be used as key for the result object
   * @param isHealthy Whether the health indicator is healthy
   * @param data Additional data which will get appended to the result object
   */
  protected getStatus(
    key: string,
    isHealthy: boolean,
    data?: {
      [key: string]: any;
    },
  ): HealthIndicatorResult {
    const status = isHealthy ? 'up' : 'down';
    return {
      [key]: {
        status,
        ...data,
      },
    };
  }
}
