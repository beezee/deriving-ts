import { URI } from './index'

declare module '@deriving-ts/core' {
  export interface Inputs<A> {
    GraphQLQuery: {}
    [URI]: {
      dict: {Named: string}
      sum: {Named: string}
      num?: {type: "Float" | "Int"}
      str?: {type: "String" | "ID"}
    }
  }
}
