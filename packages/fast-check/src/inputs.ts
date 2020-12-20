import type * as fc from 'fast-check';
import { URI } from './index';

type FcStrInputs =
  {type: "hexa" | "base64" | "char" | "ascii" | "unicode" | "char16bits" | "fullUnicode" |
    "ipV4" | "ipV4Extended" | "ipV6" | "uuid" | "domain" | "webAuthority" |
    "webFragments" | "webQueryParameters" | "webSegment" | "emailAddress"} |
  {type: "webUrl"} & fc.WebUrlConstraints |
  {type: "uuidV", version: 1 | 2 | 3 | 4 | 5} |
  {type: "hexaString" | "base64String" | "string" | "asciiString" |
    "unicodeString" | "string16bits" | "fullUnicodeString"} & fc.StringSharedConstraints |
  {type: "json" | "unicodeJson"} & fc.JsonSharedConstraints |
  {type: "lorem"} & fc.LoremConstraints

type FcNumInputs =
  {type: "maxSafeInteger" | "maxSafeNat"} |
  {type: "integer"} & fc.IntegerConstraints |
  {type: "nat"} & fc.NatConstraints |
  {type: "float"} & fc.FloatConstraints |
  {type: "double"} & fc.DoubleConstraints //|
  // These return a different type. Determine whether to support `bigint`
  /*{type: "bigInt"} & fc.BigIntConstraints |
  {type: "bigUint"} & fc.BigUintConstraints |
  {type: "bigIntN" | "bigUintN", n: number}*/

type FCRec<A> = {baseCase: A}

declare module '@deriving-ts/core' {
  export interface Inputs<A> {
    [URI]: {
      str?: FcStrInputs,
      num?: FcNumInputs,
      date?: {min?: Date, max?: Date}
      recurse: FCRec<A>
      nullable?: {freq: number}
      array?: fc.ArrayConstraints
    }
  }
}

