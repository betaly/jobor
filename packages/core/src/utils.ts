import {AnyObj} from 'tily/typings/types';

/**
 * Simple object check.
 * From https://stackoverflow.com/a/34749873/772859
 */
export function isObject(item: unknown): item is AnyObj {
  return Boolean(item) && typeof item === 'object' && !Array.isArray(item);
}

export function isClassInstance(item: unknown): boolean {
  // Even if item is an object, it might not have a constructor as in the
  // case when it is a null-prototype object, i.e. created using `Object.create(null)`.
  return isObject(item) && item.constructor && (item.constructor as Function).name !== 'Object';
}

export function notNullOrUndefined<T>(x: T | undefined | null): x is T {
  return x !== undefined && x !== null;
}
