import test from "ava";
import * as lib from '@deriving-ts/core'
import * as gql from './interpreter';
import { buildASTSchema, printSchema } from 'graphql';

type Ops = "str" | "num" | "nullable" | "array" | "recurse" | "dict"
type Inputs = "GraphQL"

type Alg<F extends lib.Target> = lib.Alg<F, Ops, Inputs>
const thingProps = <F extends lib.Target>(T: Alg<F>) => ({
  foo: T.nullable({ of: T.str({}) }),
  bar: T.num({}),
  tail: T.recurse('Thing', () => thing<F>(T),
      (of) => T.array({of: T.nullable({of})}), {}),
  tail2: T.recurse('Thing', () => thing<F>(T),
      (of) => T.array({of}), {})
});

type Thing = {foo: string | null, bar: number, tail: (Thing | null)[], tail2: Thing[]}

const thing = <F extends lib.Target>(T: Alg<F>): lib.Result<F, Thing> =>
  T.dict({GraphQL: {Named: 'Thing'}, props: () => thingProps(T)})

const thingNoRecProps = <F extends lib.Target>(T: Alg<F>) => {
  const {foo, bar} = thingProps(T)
  return {foo, bar}
}

const thingNoRec = <F extends lib.Target>(T: Alg<F>) =>
  T.dict({GraphQL: {Named: 'ThingNoRec'}, props: () => thingNoRecProps(T)})

const tnr = thingNoRec(lib.Type)
type ThingNoRec = lib.TypeOf<typeof tnr>
const takeThingNoRec = (_: ThingNoRec): void => undefined
takeThingNoRec({foo: "hi", bar: 3})

type ResolverAlg<F extends lib.Target> = lib.Alg<F, Ops | "gqlResolver", Inputs>

const tnrResolver = <F extends lib.Target>(T: ResolverAlg<F>) =>
  T.dict({GraphQL: {Named: 'ThingResolvers'}, props: () =>
    ({...thingNoRecProps(T),
     count: T.gqlResolver({
      parent: thingNoRec(T), args: {
        GraphQL: {Named: "ThingCountInput"}, props: () => ({foo: T.str({})})},
      context: T.dict({GraphQL: {Named: 'TRArgs'}, props: () => ({})}),
      output: T.num({})})})})

const trs = tnrResolver(lib.Type)
type ThingResolvers = lib.TypeOf<typeof trs>
const takeThingResolvers = (_: ThingResolvers): void => undefined
takeThingResolvers({foo: "hi", bar: 3,
  count: (parent: ThingNoRec, args: {foo: string}, context: unknown) => Promise.resolve(2)})

const schema = (x: any) =>
  buildASTSchema({kind: "Document", definitions: x})

const Gql = gql.GQL()
test("test", async t => {
  thingNoRec(Gql)
  thing(Gql)
  tnrResolver(Gql)
  console.log(printSchema(schema(Gql.definitions)))
});
