import {PromiseOrValue} from 'tily/typings/types';

export type Resource<T extends object> = () => PromiseOrValue<T>;
