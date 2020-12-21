import * as t from 'typelevel-ts';
export * from './types';
export * from './utils';

export interface Targets<A> {
  Id: A
  Type: (a: A) => void
};

export type Target = keyof Targets<any>
export type Result<T extends Target, A> = Targets<A>[T];

export type UndefKeys<A extends object> = 
  { [K in keyof A]: undefined extends A[K] ? K : never }[keyof A]
export type NeverKeys<A extends object> = 
  { [K in keyof A]: A[K] extends never ? K : never }[keyof A]

export interface Inputs<A> {}

type Ix<K extends string, T> = K extends keyof T ? T[K] : never

type _Input<T extends string, I extends keyof Inputs<any>, A> =
    {[k in I]: Ix<T, Inputs<A>[k]>}

export type InputOf<T extends string, I extends Input, A> =
    Omit<t.Diff<_Input<T, I, A>, UndefKeys<_Input<T, I, A>>>, NeverKeys<_Input<T, I, A>>>

export type Input = keyof Inputs<any>

export interface _Alg<T extends Target, I extends Input = never> {}

export type Alg<T extends Target, K extends keyof _Alg<Target, Input>, I extends Input = never> =
  Pick<_Alg<T, I>, K>

export const Type: Alg<"Type", keyof _Alg<Target, Input>> = 
  new Proxy({}, {get: () => (...args: any) => (_: any) => undefined}) as any

export type TypeOf<A> = A extends (a: infer B) => void ? B : never
