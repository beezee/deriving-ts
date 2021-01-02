import test from "ava";
import * as lib from '@deriving-ts/core'
import * as gql from './interpreter';
import type * as def from 'graphql/type/definition';
import { buildASTSchema, printSchema } from 'graphql';

type Ops = "str" | "bool" | "num" | "nullable" | "array" | "recurse" | "dict" | "dictWithResolvers"
type Inputs = "GraphQL"

type Alg<F extends lib.Target> = lib.Alg<F, Ops, Inputs>
const thingProps = <F extends lib.Target>(T: Alg<F>) => ({
  foo: T.nullable({ of: T.str({GraphQL: {type: "ID"}}) }),
  bar: T.num({GraphQL: {type: "Float"}}),
  baz: T.nullable({ of: T.bool({}) }),
  tail: T.recurse('Thing', () => thing<F>(T),
      (of) => T.array({of: T.nullable({of})}), {}),
  tail2: T.recurse('Thing', () => thing<F>(T),
      (of) => T.array({of}), {})
});

type Thing = {foo: string | null, baz: boolean | null, bar: number, tail: (Thing | null)[], tail2: Thing[]}

const thing = <F extends lib.Target>(T: Alg<F>): lib.Result<F, Thing> =>
  T.dict({GraphQL: {Named: 'Thing'}, props: () => thingProps(T)})

const thingNoRecProps = <F extends lib.Target>(T: Alg<F>) => {
  const {foo, bar} = thingProps(T)
  return {foo, bar}
}

const thingNoRec = <F extends lib.Target>(T: Alg<F>) =>
  T.dict({GraphQL: {Named: 'ThingNoRec'}, props: () => thingNoRecProps(T)})

const assertTnr = thingNoRec(lib.Type)
type ThingNoRec = lib.TypeOf<typeof assertTnr>
const takeThingNoRec = (x: ThingNoRec): void => assertTnr(x)
takeThingNoRec({foo: "hi", bar: 3})

type ResolverAlg<F extends lib.Target> = lib.Alg<F, 
  lib.AlgOps<Alg<F>> | "gqlResolver" | "gqlScalar", Inputs>

const dateConfig: def.GraphQLScalarTypeConfig<Date, any> = {name: "Date"}
const SDate = <F extends lib.Target>(T: ResolverAlg<F>) =>
  T.gqlScalar({config: dateConfig})
const sdateType = SDate(lib.Type)
type SDate = lib.TypeOf<typeof sdateType>
sdateType(new Date())

const tnrResolver = <F extends lib.Target>(T: ResolverAlg<F>) =>
  T.dictWithResolvers('ThingR', {props: () =>
    ({...thingNoRecProps(T),
     time: T.nullable({of: SDate(T)})})},
     {resolvers: () => ({
       count: T.gqlResolver({
        parent: thingNoRec(T), args: {
          GraphQL: {Named: "ThingCountInput"}, props: () => ({thing: T.array({of: thing(T)})})},
        context: lib.type<unknown>(),
        output: T.num({})})})})

const assertTrs = tnrResolver(lib.Type)
type ThingR = lib.TypeOf<typeof assertTrs.result>
const takeThingR = (x: ThingR): void => assertTrs.result(x)
takeThingR({foo: "hi", bar: 3, time: new Date()})
type ThingResolvers = typeof assertTrs.resolvers
const x: ThingResolvers = {
  ThingR: {
    count: (parent: ThingNoRec, args: {input: {thing: Thing[]}}, context: unknown) => 
      Promise.resolve(2)
  }
}

const schema = (x: any) =>
  buildASTSchema({kind: "Document", definitions: x})

const Gql = gql.GQL()
test("test", async t => {
  tnrResolver(Gql)
  console.log(printSchema(schema(Gql.definitions())))
  t.true(true)
});

