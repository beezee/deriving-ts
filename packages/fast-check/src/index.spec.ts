import * as lib from '@deriving-ts/core';
import * as fci from './interpreter';
import { testProp, fc } from 'ava-fast-check';

type Ops = "str" | "num" | "nullable" | "array" | "recurse" | "dict"
type Inputs = "FastCheck"

type Alg<F extends lib.Target> = lib.Alg<F, Ops, Inputs>
const thingProps = <F extends lib.Target>(T: Alg<F>) => ({
  foo: T.nullable({
    of: T.str({FastCheck: {type: "lorem", mode: "sentences"}}),
    FastCheck: {freq: 10}}),
  bar: T.num({FastCheck: {type: "float", max: 10}}),
  tail: T.recurse('Thing', () => thing<F>(T),
      (of) => T.array({of: T.nullable({of}), FastCheck: {minLength: 3, maxLength: 3}}),
      {FastCheck: {baseCase: []}}),
  tail2: T.recurse('Thing', () => thing<F>(T),
      (of) => T.array({of, FastCheck: {minLength: 1, maxLength: 2}}),
      {FastCheck: {baseCase: []}})
});

type Thing = 
  {foo: string | null, bar: number, tail: (Thing | null)[], tail2: Thing[]}

const thing = <F extends lib.Target>(T: Alg<F>): lib.Result<F, Thing> =>
  T.dict({props: () => thingProps(T)})
const arbThing: fc.Arbitrary<Thing> = thing(fci.FastCheck())(3)

const thingNoRecProps = <F extends lib.Target>(T: Alg<F>) => {
  const {foo, bar} = thingProps(T)
  return {foo, bar}
}

const thingNoRec = <F extends lib.Target>(T: Alg<F>) =>
  T.dict({props: () => thingNoRecProps(T)})

const assertTnr = thingNoRec(lib.Type)
type ThingNoRec = lib.TypeOf<typeof assertTnr>
const arbThingNoRec: fc.Arbitrary<ThingNoRec> = thingNoRec(fci.FastCheck())(0)
const takeThingNoRec = (x: ThingNoRec): void => assertTnr(x)
takeThingNoRec({foo: "hi", bar: 3})

testProp('whatever', [arbThing, arbThingNoRec], (t, th: Thing, tnr: ThingNoRec) => {
  console.log(JSON.stringify(th, null, 2))
  console.log(JSON.stringify(tnr, null, 2))
  t.true(true)
});

const takeThing = (_: Thing): void => undefined
takeThing({foo: "hi", bar: 3, tail: [{foo: null, bar: 2, tail: [], tail2: []}, null], tail2: []})

