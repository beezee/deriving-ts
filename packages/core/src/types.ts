import * as lib from './index';
import { Target } from './index';

// Strings
declare module './index' {
  interface _Alg<T extends Target, I extends Input> {
    str: (i: lib.InputOf<'str', I, string>) => lib.Result<T, string>
  }
}

// Numbers
declare module './index' {
  interface _Alg<T extends Target, I extends Input> {
    num: (i: lib.InputOf<'num', I, number>) => lib.Result<T, number>
  }
}

// Dates
declare module './index' {
  interface _Alg<T extends Target, I extends Input> {
    date: (i: lib.InputOf<'date', I, Date>) => lib.Result<T, Date>
  }
}

// Dates
declare module './index' {
  interface _Alg<T extends Target, I extends Input> {
    bool: (i: lib.InputOf<'bool', I, boolean>) => lib.Result<T, boolean>
  }
}

// Nullable
declare module './index' {
  interface _Alg<T extends Target, I extends Input> {
    nullable: <A>(i: {of: lib.Result<T, A>} & lib.InputOf<'nullable', I, A>) =>
      lib.Result<T, A | null>
  }
}

// Array
declare module './index' {
  interface _Alg<T extends Target, I extends Input> {
    array: <A>(i: {of: lib.Result<T, A>} & lib.InputOf<'array', I, A>) =>
      lib.Result<T, A[]>
  }
}

// Recurse
declare module './index' {
  interface _Alg<T extends Target, I extends Input> {
    recurse: <A, B>(
      id: string, res: () => lib.Result<T, A>,
      map: (a: lib.Result<T, A>) => lib.Result<T, B>,
      i: lib.InputOf<"recurse", I, B>) => lib.Result<T, B>
  }
}

// Dict
export type Props<T extends Target, P> = { [K in keyof P]: lib.Result<T, P[K]> };
export type DictArgs<T extends Target, I extends lib.Input, P> =
  lib.InputOf<"dict", I, P> & {props: () => Props<T, P>}

declare module './index' {
  interface _Alg<T extends Target, I extends Input> {
    dict: <P>(i: DictArgs<T, I, P>) =>
      lib.Result<T, P>;
  }
};

// Sum
declare module './index' {
  interface _Alg<T extends Target, I extends Input> {
    sumMembers: <K extends string, A>(
      i: lib.InputOf<'sumMembers', I, {[k in keyof A]: A[k] & {[x in K]: k}}> & 
      {key: K, props: {[k in keyof A]: lib.Result<T, A[k]>}}) =>
        lib.Result<T, {[k in keyof A]: A[k] & {[x in K]: k}}>,
    sum: <K extends string, A>(
      i: lib.InputOf<'sum', I, {[k in keyof A]: A[k] & {[x in K]: k}}[keyof A]> & 
      {key: K, props: {[k in keyof A]: lib.Result<T, A[k]>}}) =>
        lib.Result<T, {[k in keyof A]: A[k] & {[x in K]: k}}[keyof A]>
  }
}
