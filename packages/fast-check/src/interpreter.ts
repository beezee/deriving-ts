import * as fc from 'fast-check';
import * as lib from '@deriving-ts/core';
import { URI } from './index';

declare module '@deriving-ts/core' {
  export interface Targets<A> {
    [URI]: fc.Memo<A>
  }
}

const str = ({FastCheck: input}: lib.InputOf<"str", URI, string>):
fc.Memo<string> => fc.memo(_ => {
  if (!input) return fc.string()
  // because of this https://github.com/microsoft/TypeScript/issues/33591
  switch (input.type) {
    case "string": case "hexa": case "base64": case "char": case "ascii": case "unicode":
    case "char16bits": case "fullUnicode": case "ipV4": case "ipV4Extended":
    case "ipV6": case "uuid": case "domain": case "webAuthority":
    case "webFragments": case "webQueryParameters": case "webSegment": case "emailAddress":
      return fc[input.type]() as fc.Arbitrary<string>
    case "webUrl":
      return fc.webUrl(input)
    case "uuidV":
      return fc.uuidV(input.version)
    case "hexaString": case "base64String": case "string": case "asciiString":
    case "unicodeString": case "string16bits": case "fullUnicodeString":
      return fc[input.type](input) as fc.Arbitrary<string>
    case "json": case "unicodeJson":
      return fc[input.type](input) as fc.Arbitrary<string>
    case "lorem":
      return fc.lorem(input)
    default:
      return lib.absurd(input)
  }
})

const num = ({FastCheck: input}: lib.InputOf<"num", "FastCheck", number>):
fc.Memo<number> => fc.memo(_ => {
  if (!input) return fc.integer()
  // because of this https://github.com/microsoft/TypeScript/issues/33591
  switch(input.type) {
    case "integer":
      return fc.integer(input)
    case "maxSafeInteger": case "maxSafeNat":
      return fc[input.type]()
    case "nat":
      return fc.nat(input)
    case "float":
      return fc[input.type](input)
    case "double":
      return fc[input.type](input)
    // These return a different type. Determine whether to support `bigint`
    /*case "bigInt":
      return fc[input.type](input)
    case "bigUint":
      return fc[input.type](input)
    case "bigIntN": case "bigUintN":
      return fc[input.type](input.n)*/
    default:
      return lib.absurd(input)
  }
})

export type FCAlg = lib.Alg<URI, 
  "bool" | "str" | "num" | "nullable" | "array" | "recurse" | "dict" | "sum",
  URI>

export const FastCheck: () => FCAlg = () => {
  const dict = <T>({props: mkProps}: lib.DictArgs<URI, URI, T>) => {
    const props = mkProps()
    return fc.memo(n => Object.keys(props).reduce((a, k) =>
      a.chain(o => props[k as keyof T](n-1).map(v => ({...o, [k]: v}))), fc.constant({} as T)))
  }
  return ({str, num, 
    bool: () => fc.memo(n => fc.boolean()),
    nullable: ({of: x, FastCheck: input}) => 
      fc.memo(n => fc.option(x(n), input || {})),
    array: ({of: x, FastCheck: input}) => fc.memo(n => fc.array(x(n), input || {})),
    recurse: (_, f, map, i) => fc.memo(n =>
      n <= 1 ? fc.constant(i.FastCheck.baseCase) : map(f())(n)),
    sum: <K extends string, A>(
      i: {key: K, props: {[k in keyof A]: lib.Props<URI, A[k]>}}):
      lib.Result<URI, {[k in keyof A]: A[k] & {[x in K]: k}}[keyof A]> =>
        fc.memo(n => fc.oneof(...Object.keys(i.props).map(k =>
          dict({props: () => i.props[k as keyof A]})(n).map(
          d => ({...d, ...({[i.key as K]: k} as {[x in K]: keyof A})}))))),
    dict
  })
}

