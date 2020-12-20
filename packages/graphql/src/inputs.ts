import { URI } from './index'

declare module '@deriving-ts/core' {
  export interface Inputs<A> {
    [URI]: {
      dict: {Named: string}
    }
  }
}
