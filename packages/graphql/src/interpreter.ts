import { URI } from './index'
import * as lib from '@deriving-ts/core'
import type * as def from 'graphql/type/definition';
import { GraphQLScalarType } from 'graphql/type/definition';
import type * as ast from 'graphql/language/ast'

type GQL = {
  prefix: string, tpe: string, children: string, optional: boolean,
  array: boolean}

type ResolverPair<P, A, C, O> = 
  { server: (parent: P, args: {input: A}, context: C) => Promise<O>,
    client: (args: A) => Promise<O> }

type ResolverPairResult<T extends lib.Target, P, A, C, O> = 
  {[k in keyof ResolverPair<P, A, C, O>]: lib.Result<T, ResolverPair<P, A, C, O>[k]>}

declare module "@deriving-ts/core" {
  export interface Targets<A> {
    GraphQL: ast.TypeNode & {arg?: ast.TypeNode, isResolver?: boolean}
  }
  type ArgsType<A> = A extends null ? unknown : A
  interface _Alg<T extends Target, I extends Input> {
    gqlResolver: <Parent, Args, Context, Output>(i: lib.InputOf<"gqlResolver", I, Output> & {
      parent: Result<T, Parent>, args: lib.DictArgs<T, I, Args> | null,
      context: (c: Context) => void, output: Result<T, Output>}) =>
      ResolverPairResult<T, Parent, Args, Context, Output>
    gqlScalar: <A>(i: lib.InputOf<"gqlScalar", I, A> & {
      config: def.GraphQLScalarTypeConfig<A, any> }) => Result<T, A>
    dictWithResolvers: <K extends string, P, R>(
      k: K, 
      i: lib.InputOf<"dictWithResolvers", I, P> & {props: () => lib.Props<T, P>},
      r: {resolvers: () => {[k in keyof R]: {server: lib.Result<T, R[k]>}}}) =>
      {resolvers: {[k in K]: R}, result: lib.Result<T, P>}
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

type GQLAlg = lib.Alg<URI,
  "str" | "num" | "nullable" | "array" | "bool" | "sum" |
  "recurse" | "dict" | "gqlResolver" | "gqlScalar" |
  "dictWithResolvers",
  URI>

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
  const serverResolvers = <R>(resolvers: {[k in keyof R]: {server: lib.Result<URI, R[k]>}}):
  lib.Props<URI, R> =>
    Object.keys(resolvers).reduce(
      (acc, k) => ({...acc, [k]: resolvers[k as keyof R].server}), {} as any)
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
      ({ server: {...o, ...(a ? {arg: input(a)} : {}), isResolver: true}, client: {} as any}),
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
      {resolvers}: {resolvers: () => {[k in keyof R]: {server: lib.Result<URI, R[k]>}}}) => {
      const ret = dict({GraphQL: {Named}, props: mkProps})
      const props = parseProps(serverResolvers(resolvers()))
      mergeDef(Named, object(Named, props.map(t => t[1])))
      props.forEach(([k, _, r]) => {
        if (r) _resolveCache[Named] = (Named in _resolveCache)
          ? ({...(_resolveCache[Named]), [k]: r})
          : {[k]: r}
      })
      return {resolvers: {} as any, result: ret}
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

const isObject = (v: any): v is object => v && typeof v === 'object';
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

// TODO - this return type is a disappointment
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
