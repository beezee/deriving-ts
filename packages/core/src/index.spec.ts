import { makeMatchers } from 'ts-adt/MakeADT';
import test from "ava";
import * as lib from './index';

type Ops = "sum" | "sumMembers" | "str" | "bool" | "num" | "nullable" | 
  "array" | "recurse" | "dict"

type Alg<F extends lib.Target> = lib.Alg<F, Ops>

const t1Props = <F extends lib.Target>(T: Alg<F>) => ({
  foo: T.nullable({ of: T.str({GraphQL: {type: "ID"}}) }),
  bar: T.num({GraphQL: {type: "Float"}}),
  baz: T.nullable({ of: T.bool({}) }),
});

const t2Props = <F extends lib.Target>(T: Alg<F>) => ({
  bar: T.nullable({ of: T.str({GraphQL: {type: "ID"}}) }),
  baz: T.num({GraphQL: {type: "Float"}}),
  quux: T.nullable({ of: T.bool({}) }),
});

const t3Props = <F extends lib.Target>(T: Alg<F>) => ({
  baz: T.nullable({ of: T.str({GraphQL: {type: "ID"}}) }),
  quux: T.num({GraphQL: {type: "Float"}}),
  foo: T.nullable({ of: T.bool({}) }),
});

const adtMembers = <F extends lib.Target>(T: Alg<F>) =>
  ({t1: t1Props(T), t2: t2Props(T), t3: t3Props(T)})

const adt = <F extends lib.Target>(T: Alg<F>) =>
  T.sumMembers({key: "type", props: adtMembers(T)})

const sum = <F extends lib.Target>(T: Alg<F>) =>
  T.sum({key: "type", props: adtMembers(T)})

const assertSum = sum(lib.Type)

const assertAdt = adt(lib.Type)
type ADTM = lib.TypeOf<typeof assertAdt>
type ADT = ADTM[keyof ADTM]

const to = (x: ADT) => assertSum(x)
const from = (x: lib.TypeOf<typeof assertSum>) => to(x)

const takeAdt = (x: ADT): void => undefined
takeAdt({foo: "hi", bar: 3, baz: true, type: "t1"})

const takeT2 = (x: ADTM["t2"]): void => undefined
takeT2({bar: null, baz: 2, quux: false, type: "t2"})

const matchI = makeMatchers("type")[2]
const x: string | null = matchI<ADT>(
  {bar: null, baz: 2, quux: false, type: "t2"})(
  {t1: (x) => x.foo, t2: (x) => x.bar, t3: (x) => x.baz})

test("test", async t => {
  t.true(true)
});


