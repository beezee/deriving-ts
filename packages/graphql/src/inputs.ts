import { URI } from './index'

declare module '@deriving-ts/core' {
  export interface Inputs<A> {
    [URI]: {
      dict: {Named: string}
      num?: {type: "Float" | "Int"}
      str?: {type: "String" | "ID"}
    }
  }
}
