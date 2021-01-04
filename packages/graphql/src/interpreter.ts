import { URI } from './index'
import * as lib from '@deriving-ts/core'
import type * as def from 'graphql/type/definition';
import { GraphQLScalarType } from 'graphql/type/definition';
import type * as ast from 'graphql/language/ast'

type GQL = {
  prefix: string, tpe: string, children: string, optional: boolean,
  array: boolean}

type GraphQLQuery<A> = [A] extends [A]
  ? (a: ClientResolved<A>) => <T>(f: (a: QueryField<Client<A>>) => T) => UnQueryField<GetUQB<A>, T>
  : never

type ApGraphQLQuery<A> = [A] extends [(i: infer I) => infer O]
  ? (i: I) => <T>(f: (a: QueryField<Client<O>>) => T) => UnQueryField<GetUQB<O>, T>
  : [A] extends [(p: any, i: infer I, c: any) => Promise<infer O>]
    ? (i: I) => <T>(f: (a: QueryField<Client<O>>) => T) => UnQueryField<GetUQB<O>, T>
    : <T>(f: (a: QueryField<Client<A>>) => T) => UnQueryField<GetUQB<A>, T>

export type QueryField<A> = [A] extends [(i: infer I) => infer O]
  ? (i: I) => QueryField<O>
  : [A] extends [(p: any, i: infer I, c: any) => Promise<infer O>]
    ? (i: I) => QueryField<O>
    : [A] extends [Array<(infer X)>]
      ? QueryField<X>
      : [A] extends [{[key: string]: any}]
        ? {[k in keyof A]: ApGraphQLQuery<A[k]>}
        : {__compileTimeOnlyQueryFieldA: NonNullable<A>, __gqlQueryField: any}

const toQueryField = <A>(a: A): QueryField<A> => a as unknown as QueryField<A>
const fromQueryField = <A>(a: QueryField<A>): A => a as unknown as A

type Resolvers = {[key: string]: (parent: any, args: any, context: any) => Promise<any>}
type DWRClient<P, R extends Resolvers> = 
  P & {[k in keyof R]: ClientResolver<R[k]>}
interface DWR<T extends lib.Target, K extends string, R extends Resolvers, P> {
  resolvers: {[k in K]: R}, result: lib.Result<T, P>,
  client: lib.Result<T, DWRClient<P, R>>}

export type ClientResolver<A> = [A] extends [(p: any, a: infer I, c: any) => Promise<infer O>]
  ? (a: I) => O
  : A

export type Client<A> = [A] extends [DWR<any, any, infer R, infer P>]
  ? DWRClient<P, R>
  : A

export type ClientResolved<A> = [A] extends [(a: infer I) => infer O]
  ? O
  : [A] extends [(p: any, i: infer I, c: any) => Promise<infer O>]
    ? O
    : [A] extends [any[]]
      ? A
      : [A] extends [Record<string, any>]
        ? {[k in keyof A]: ClientResolved<A[k]>}
        : A

interface UQFunctors<A> {
  ID: A
  List: A[]
  Nullable: A | null
}
type UQBrand = keyof UQFunctors<any>
type UQFunctor<B extends UQBrand, A> = UQFunctors<A>[B]

export type UnQueryField<B extends UQBrand, A> =
  "__compileTimeOnlyQueryFieldA" extends keyof A
    ? UQFunctor<B, A["__compileTimeOnlyQueryFieldA"]>
    : UQFunctor<B, A>

type GetUQB<A> = [A] extends [any[]] ? "List" : [null] extends [A] ? "Nullable" : "ID"

const unQueryField = <B extends UQBrand>() => <T>(t: UQFunctor<B, T>): UnQueryField<B, T> =>
  t as UnQueryField<B, T>

declare module "@deriving-ts/core" {
  export interface Targets<A> {
    GraphQL: ast.TypeNode & {arg?: ast.TypeNode, isResolver?: boolean}
    GraphQLQuery: GraphQLQuery<A>
  }
  type ArgsType<A> = A extends null ? unknown : A
  interface _Alg<T extends Target, I extends Input> {
    gqlResolver: <Parent, Args, Context, Output>(i: lib.InputOf<"gqlResolver", I, Output> & {
      parent: Result<T, Parent>, args: lib.DictArgs<T, I, Args> | null,
      context: (c: Context) => void, output: Result<T, Output>}) =>
      lib.Result<T, (parent: Parent, args: {input: Args}, context: Context) => Promise<Output>>
    gqlScalar: <A>(i: lib.InputOf<"gqlScalar", I, A> & {
      config: def.GraphQLScalarTypeConfig<A, any> }) => Result<T, A>
    dictWithResolvers: <K extends string, P, R extends Resolvers>(
      k: K, 
      i: lib.InputOf<"dictWithResolvers", I, P> & {props: () => lib.Props<T, P>},
      r: {resolvers: () => {[k in keyof R]: lib.Result<T, R[k]>}}) =>
      DWR<T, K, R, P>
  }
}

const gqlScalar = (tpe: string): ast.TypeDefinitionNode =>
  ({"kind": "ScalarTypeDefinition",
    "name": {"kind": "Name", "value": tpe}})

const namedType = (tpe: string): ast.NamedTypeNode =>
  ({"kind": "NamedType", "name": {"kind": "Name", "value": tpe}})

const gqlPrim = (tpe: string): ast.NonNullTypeNode =>
  ({"kind": "NonNullType", type: namedType(tpe)})

const option = (node: ast.TypeNode) =>
  node.kind === "NonNullType" ? node.type : node

function isTypeNode(x: ast.TypeNode | ast.TypeDefinitionNode): x is ast.TypeNode {
  return "kind" in x && (["NamedType", "ListType", "NonNullType"].indexOf(x.kind) >= 0)
}

const list = (node: ast.TypeNode): ast.TypeNode =>
  isTypeNode(node)
    ? ({kind: "NonNullType", type: {kind: "ListType", type: node}})
    : node

const object = (name: string, fields: ast.FieldDefinitionNode[]): ast.ObjectTypeDefinitionNode =>
  ({kind: "ObjectTypeDefinition",
    name: {kind: "Name", value: name},
    fields})

const inputObject = (name: string, fields: ast.InputValueDefinitionNode[]):
ast.InputObjectTypeDefinitionNode =>
  ({kind: "InputObjectTypeDefinition",
    name: {kind: "Name", value: name},
    fields})

const arg = (node: ast.TypeNode) =>
  ({kind: "InputValueDefinition" as const,
    name: {kind: "Name" as const, value: "input"},
    type: node})

const field = (name: string, node: ast.TypeNode & {arg?: ast.TypeNode, isResolver?: boolean}):
[ast.FieldDefinitionNode, boolean] =>
  [({kind: "FieldDefinition",
    name: {kind: "Name", value: name},
    arguments: node.arg ? [arg(node.arg)] : [],
    type: node}), node.isResolver || false]

const inputField = (name: string, node: ast.TypeNode):
ast.InputValueDefinitionNode =>
  ({kind: "InputValueDefinition",
    name: {kind: "Name", value: name},
    type: node})

const union = (name: string, types: ast.NamedTypeNode[]):
ast.UnionTypeDefinitionNode =>
  ({kind: "UnionTypeDefinition",
    name: {kind: "Name", value: name},
    types})

type Ops = "str" | "num" | "nullable" | "array" | "bool" | "sum" |
  "recurse" | "dict" | "gqlResolver" | "gqlScalar" |
  "dictWithResolvers"
type GQLAlg = lib.Alg<URI, Ops, URI>

const uniqFields = <A extends {name: {value: string}}>(la: A[], ra: A[]): A[] => {
  const dedup: Record<string, A> = {}
  la.forEach(x => dedup[x.name.value] = x)
  ra.forEach(x => dedup[x.name.value] = x)
  return Object.keys(dedup).reduce((acc, k) => [...acc, dedup[k]], [] as A[])
}

export const GQL: () => GQLAlg & {
  definitions: () => ast.TypeDefinitionNode[],
  scalars: () => {[key: string]: def.GraphQLScalarType},
  resolvers: () => {[key: string]: object},
  discriminants: () => {[key: string]: object}} = () => {
  let definitions: {[key: string]: ast.TypeDefinitionNode} = {}
  const mergeDef = (key: string, node: ast.TypeDefinitionNode) => {
    const def = definitions[key]
    if (def && def.kind === "InputObjectTypeDefinition" && 
        node.kind === "InputObjectTypeDefinition")
      definitions[key] = {...def,
        fields: uniqFields((def.fields || []).slice(), (node.fields || []).slice())}
    else if (def && def.kind === "ObjectTypeDefinition" &&
             node.kind === "ObjectTypeDefinition")
      definitions[key] = {...def,
        fields: uniqFields((def.fields || []).slice(), (node.fields || []).slice())}
    else
      definitions[key] = node
  }
  let scalars: {[key: string]: def.GraphQLScalarType} = {}
  const _cache: {[key: string]: ast.TypeNode} = {}
  const memNamed = lib.memo(_cache)
  const _resolveCache: {[key: string]: object} = {}
  const _discriminantCache: {[key: string]: object} = {}
  const input = <T>({GraphQL: {Named}, props: mkProps}: lib.DictArgs<URI, URI, T>) => {
    if (Named in _cache) return _cache[Named]
    const ret = memNamed(Named, () => gqlPrim(Named))
    const props = mkProps()
    mergeDef(Named, inputObject(Named, Object.keys(props)
      .map(k => inputField(k, props[k as keyof lib.Props<URI, T>]))))
    return ret
  }
  const parseProps = <P>(props: lib.Props<URI, P>):
  [keyof P, ast.FieldDefinitionNode, boolean][] =>
    Object.keys(props).map(k => {
      const [fd, rs] = field(k, props[k as keyof lib.Props<URI, P>])
      return [k as keyof P, fd, rs]
    })
  const dict = <T>({GraphQL: {Named}, props: mkProps}: lib.DictArgs<URI, URI, T>) => {
    if (Named in _cache) return _cache[Named]
    const ret = memNamed(Named, () => gqlPrim(Named))
    const props = parseProps(mkProps())
    mergeDef(Named, object(Named, props.map(t => t[1])))
    props.forEach(([k, _, r]) => {
      if (r) _resolveCache[Named] = (Named in _resolveCache)
        ? ({...(_resolveCache[Named]), [k]: r})
        : {[k]: r}
    })
    return ret
  }
  return {
    definitions: () => Object.keys(definitions).map(k => definitions[k]),
    scalars: () => ({...scalars}),
    discriminants: () => ({..._discriminantCache}),
    resolvers: () => ({..._resolveCache}),
    str: (i) => gqlPrim(i.GraphQL?.type || 'String'),
    bool: () => gqlPrim('Boolean'),
    num: (i) => gqlPrim(i.GraphQL?.type || "Int"),
    nullable: ({of}) => option(of),
    array: ({of}) => list(of),
    recurse: (id, f, map = (x) => x) => map(memNamed(id, f)),
    gqlScalar: ({config: i}) => memNamed(i.name, () => {
      scalars[i.name] = new GraphQLScalarType(i)
      definitions[i.name] = gqlScalar(i.name)
      return gqlPrim(i.name)
    }),
    gqlResolver: ({parent: p, args: a, context: c, output: o}) =>
      ({...o, ...(a ? {arg: input(a)} : {}), isResolver: true}),
    // TODO - support recursive types in a union
    sum: <K extends string, A>(
      i: {GraphQL: {Named: string}, key: K, props: {[k in keyof A]: lib.Result<URI, A[k]>}}) => {
        const {GraphQL: {Named}} = i
        mergeDef(Named, union(Named, Object.keys(i.props).map(namedType)))
        _discriminantCache[Named] = (Named in _discriminantCache)
          ? {..._discriminantCache[Named], 
            __resolveType: (p: {[k in keyof A]: A[k] & {[x in K]: k}}[keyof A]) => p[i.key]}
          : {__resolveType: (p: {[k in keyof A]: A[k] & {[x in K]: k}}[keyof A]) => p[i.key]}
        return gqlPrim(i.GraphQL.Named)
    },
    dict,
    dictWithResolvers: <K extends string, P, R>(
      Named: K,
      {props: mkProps}: lib.InputOf<"dictWithResolvers", URI, P> & 
        {props: () => lib.Props<URI, P>},
      {resolvers}: {resolvers: () => {[k in keyof R]: lib.Result<URI, R[k]>}}) => {
      const ret = dict({GraphQL: {Named}, props: mkProps})
      const props = parseProps(resolvers())
      mergeDef(Named, object(Named, props.map(t => t[1])))
      props.forEach(([k, _, r]) => {
        if (r) _resolveCache[Named] = (Named in _resolveCache)
          ? ({...(_resolveCache[Named]), [k]: r})
          : {[k]: r}
      })
      return {resolvers: {} as any, result: ret, client: {} as any}
    }
  }
};

const merge = (obj1: Record<string, any>, obj2: Record<string, any>) => {
  const recursiveMerge = (obj: Record<string, any>, entries: Record<string, any>) => {
    for (const key of Object.keys(entries)) {
      const value: any = entries[key]
      if (typeof value === "object") {
        obj[key] = key in obj ? {...obj[key]} : {};
        recursiveMerge(obj[key], value)
      } else {
        obj[key] = value
      }
    }
    return obj;
  }
  const copy = recursiveMerge({}, obj1)
  return recursiveMerge(copy, obj2)
}

type GqlProg = (a: GQLAlg) => (lib.Result<URI, any> | {result: lib.Result<URI, any>})

const isObject = (v: any): v is object => v && typeof v === 'object' && !Array.isArray(v);
function haltMissing(path: string[], a: Record<string, any>, b: Record<string, any>): void {
    const missing: [string[], string][] = []
    const rec = (path: string[], a: Record<string, any>, b: Record<string, any>): void => {
      const _ = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).forEach(
        k => ({ [k]: isObject(a[k])
            ? rec([...path, k], a[k], isObject(b[k]) ? b[k] : {})
            : (k in a && !!a[k]) ? (k in b) ? true : missing.push([path, k]) : true
        }));
    }
    rec(path, a, b)
    if (missing.length > 0)
      throw new Error(`Missing resolvers \n\t${
        missing.map(([p, k]) => `${p.join(".")}.${k}`).join("\n\t")}`)
}

export const BuildSchema = <Q, M>(defs: GqlProg[], resolvers: any[]):
{typeDefs: ast.DocumentNode, resolvers: any} => {
  const interp = GQL()
  defs.forEach(def => def(interp))
  const typeDefs = {kind: "Document" as const, definitions: interp.definitions()}
  const mergedResolvers = [interp.scalars(), interp.discriminants(), ...resolvers].reduce(
    (acc, e) => merge(acc, e), {} as any)
  haltMissing(["root"], interp.resolvers(), mergedResolvers)
  return ({typeDefs, resolvers: mergedResolvers})
}

  //"dictWithResolvers" | "sum"
type GQLClientAlg = lib.Alg<"GraphQLQuery", Ops, "GraphQLQuery">

export const GQLClient: () => GQLClientAlg = () => {
  const wrapDict = (p: Record<string, any>, d: Record<string, any>):
  Record<string, any> =>
    Object.keys(d).reduce((a, k) => ({...a, [k]: p[k](d[k])}), {})

  const log = <A>(a: A, x: any = null): A => { console.log(a, x); return a }
  return ({
    str: () => (s) => (f) => unQueryField<"ID">()(f(toQueryField(s))),
    bool: () => (b) => (f) => unQueryField<"ID">()(f(toQueryField(b))),
    num: () => (n) => (f) => unQueryField<"ID">()(f(toQueryField(n))),
    gqlResolver: ({output: o}: any) => (r) => (): any => (f: any) => unQueryField<"ID">()(
      o(r)(f)),
    dict: <P>({props}: lib.DictArgs<"GraphQLQuery", "GraphQLQuery", P>):
    lib.Result<"GraphQLQuery", P> => 
      (d: ClientResolved<P>) => <T>(f: (i: QueryField<Client<P>>) => T) =>
        unQueryField<GetUQB<P>>()(
          <UQFunctor<GetUQB<P>, T>>f(toQueryField(wrapDict(props(), d as any) as Client<P>))),
    array: <A>({of}: any): lib.Result<"GraphQLQuery", A[]> =>
      (as: A[]) => (f) => unQueryField<"List">()(as.map(a => 
        of(a)(f)) as any),//f(toQueryField(a)))),
    nullable: <A>(): lib.Result<"GraphQLQuery", A | null> =>
      (a: ClientResolved<A | null>) => (f) => unQueryField<GetUQB<A | null>>()(
        a === null ? (null as any) : f(toQueryField(a as Client<A>))),
    recurse: <P>(): lib.Result<"GraphQLQuery", P> => 
      (d: ClientResolved<P>) => <T>(f: (i: QueryField<Client<P>>) => T) =>
        unQueryField<GetUQB<P>>()(<UQFunctor<GetUQB<P>, T>>f(
          toQueryField(d as Client<P>))),
    gqlScalar: <P>(): lib.Result<"GraphQLQuery", P> => 
      (d: ClientResolved<P>) => <T>(f: (i: QueryField<Client<P>>) => T) =>
        unQueryField<GetUQB<P>>()(<UQFunctor<GetUQB<P>, T>>f(
          toQueryField(d as Client<P>))),
    dictWithResolvers: <K extends string, P, R extends Resolvers>(
      _: K, 
      i: lib.InputOf<"dictWithResolvers", "GraphQLQuery", P> & 
        {props: () => lib.Props<"GraphQLQuery", P>},
      r: {resolvers: () => {[k in keyof R]: lib.Result<"GraphQLQuery", R[k]>}}):
    DWR<"GraphQLQuery", K, R, P> => 
      ({resolvers: {} as any, result: {} as any, client:
        (d: ClientResolved<DWRClient<P, R>>) =>
        <T>(f: (i: QueryField<Client<DWRClient<P, R>>>) => T) =>
          unQueryField<GetUQB<DWRClient<P, R>>>()(
            <UQFunctor<GetUQB<DWRClient<P, R>>, T>>f(toQueryField(
              wrapDict({...i.props(), ...r.resolvers()}, d as any) as Client<DWRClient<P, R>>)))}),
    sum: <K extends string, A>({props}: {props: {[k in keyof A]: lib.Result<"GraphQLQuery", A[k]>}}):
    lib.Result<"GraphQLQuery", {[k in keyof A]: A[k] & {[x in K]: k}}[keyof A]> => 
      (d: ClientResolved<{[k in keyof A]: A[k] & {[x in K]: k}}[keyof A]>) => 
      <T>(f: (i: QueryField<Client<{[k in keyof A]: A[k] & {[x in K]: k}}[keyof A]>>) => 
            T) => unQueryField<GetUQB<{[k in keyof A]: A[k] & {[x in K]: k}}[keyof A]>>()(
            <UQFunctor<GetUQB<{[k in keyof A]: A[k] & {[x in K]: k}}[keyof A]>, T>>f(
              toQueryField(wrapDict(props, d as any) as Client<
                {[k in keyof A]: A[k] & {[x in K]: k}}[keyof A]>)))
  })
}
