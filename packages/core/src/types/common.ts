/* eslint-disable @typescript-eslint/no-explicit-any */

export type Maybe<T> = T;
export type InputMaybe<T> = T;
export type Exact<T extends {[key: string]: unknown}> = {[K in keyof T]: T[K]};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {[SubKey in K]?: Maybe<T[SubKey]>};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {[SubKey in K]: Maybe<T[SubKey]>};
export type MakeEmpty<T extends {[key: string]: unknown}, K extends keyof T> = {[_ in K]?: never};
export type AnyPromise = Promise<any>;
/**
 * @description
 * An entity ID. It will be either
 * a `string` or a `number`;
 *
 * @docsCategory common
 */
export type ID = string | number;

export type Json = null | boolean | number | string | Json[] | {[prop: string]: Json};

/**
 * @description
 * A type representing JSON-compatible values.
 * From https://github.com/microsoft/TypeScript/issues/1897#issuecomment-580962081
 *
 * @docsCategory common
 */
export type JsonCompatible<T> = {
  [P in keyof T]: T[P] extends Json ? T[P] : Pick<T, P> extends Required<Pick<T, P>> ? never : JsonCompatible<T[P]>;
};

export type Scalars = {
  ID: {input: string | number; output: string | number};
  String: {input: string; output: string};
  Boolean: {input: boolean; output: boolean};
  Int: {input: number; output: number};
  Float: {input: number; output: number};
  DateTime: {input: any; output: any};
  JSON: {input: any; output: any};
  Money: {input: number; output: number};
  Upload: {input: any; output: any};
};
