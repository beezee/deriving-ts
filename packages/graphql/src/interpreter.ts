import { URI } from './index'
import * as lib from '@deriving-ts/core'
import type * as def from 'graphql/type/definition';
import { GraphQLScalarType } from 'graphql/type/definition';
import type * as ast from 'graphql/language/ast'

type GQL = {
  prefix: string, tpe: string, children: string, optional: boolean,
  array: boolean}

declare module "@deriving-ts/core" {
  export interface Targets<A> {
    GraphQL: ast.TypeNode & {arg?: ast.TypeNode, resolveFn?: (...a: any) => Promise<any>}
  }
  interface _Alg<T extends Target, I extends Input> {
    gqlResolver: <Parent, Args, Context, Output>(i: lib.InputOf<"gqlResolver", I, Output> & {
      parent: Result<T, Parent>, args: lib.DictArgs<T, I, Args>,
      context: (c: Context) => void, output: Result<T, Output>,
      resolve: (parent: Parent, args: {input: Args}, context: Context) => Promise<Output>}) =>
      Result<T, (parent: Parent, args: {input: Args}, context: Context) => Promise<Output>>
    gqlScalar: <A>(i: lib.InputOf<"gqlScalar", I, A> & {
      config: def.GraphQLScalarTypeConfig<A, any> }) => Result<T, A>
    dictWithResolvers: <P, R>(
      i: lib.DictArgs<T, I, P>,
      r: {resolvers: () => lib.Props<T, R>}) =>
      lib.Result<T, P>;
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

const field = <A>(name: string, node: ast.TypeNode & {arg?: ast.TypeNode, resolveFn?: A}):
[ast.FieldDefinitionNode, A | undefined] =>
  [({kind: "FieldDefinition",
    name: {kind: "Name", value: name},
    arguments: node.arg ? [arg(node.arg)] : [],
    type: node}), node.resolveFn]

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
  resolvers: () => {[key: string]: object}} = () => {
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
  const input = <T>({GraphQL: {Named}, props: mkProps}: lib.DictArgs<URI, URI, T>) => {
    if (Named in _cache) return _cache[Named]
    const ret = memNamed(Named, () => gqlPrim(Named))
    const props = mkProps()
    mergeDef(Named, inputObject(Named, Object.keys(props)
      .map(k => inputField(k, props[k as keyof lib.Props<URI, T>]))))
    return ret
  }
  const parseProps = <P>(props: lib.Props<URI, P>):
  [keyof P, ast.FieldDefinitionNode, ((...a: any) => Promise<any>) | undefined][] =>
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
    gqlResolver: ({parent: p, args: a, context: c, output: o, resolve: r}) =>
      ({...o, arg: input(a), resolveFn: r}),
    // TODO - support recursive types in a union
    sum: <K extends string, A>(
      i: {GraphQL: {Named: string}, key: K, props: {[k in keyof A]: lib.Result<URI, A[k]>}}) => {
        const {GraphQL: {Named}} = i
        mergeDef(Named, union(Named, Object.keys(i.props).map(namedType)))
        _resolveCache[Named] = (Named in _resolveCache)
          ? {..._resolveCache[Named], 
            __resolveType: (p: {[k in keyof A]: A[k] & {[x in K]: k}}[keyof A]) => p[i.key]}
          : {__resolveType: (p: {[k in keyof A]: A[k] & {[x in K]: k}}[keyof A]) => p[i.key]}
        return gqlPrim(i.GraphQL.Named)
    },
    dict,
    dictWithResolvers: <T, R>(
      {GraphQL: {Named}, props: mkProps}: lib.DictArgs<URI, URI, T>,
      {resolvers}: {resolvers: () => lib.Props<URI, R>}) => {
      const ret = dict({GraphQL: {Named}, props: mkProps})
      const props = parseProps(resolvers())
      mergeDef(Named, object(Named, props.map(t => t[1])))
      props.forEach(([k, _, r]) => {
        if (r) _resolveCache[Named] = (Named in _resolveCache)
          ? ({...(_resolveCache[Named]), [k]: r})
          : {[k]: r}
      })
      return ret
    }
  }
};

type GQLProg<A> = (alg: GQLAlg) => lib.Result<URI, A>
type SchemaInput<Q, M> = {Query: GQLProg<Q>, Mutation?: GQLProg<M>}

import { buildASTSchema, printSchema } from 'graphql';
// TODO - this return type is a disappointment
export const BuildSchema = <Q, M>(schema: SchemaInput<Q, M>):
{typeDefs: ast.DocumentNode, resolvers: any} => {
  const interp = GQL()
  schema.Query(interp)
  if (schema.Mutation) schema.Mutation(interp)
  const typeDefs = {kind: "Document" as const, definitions: interp.definitions()}
  return ({typeDefs, resolvers: {...interp.scalars(), ...interp.resolvers()}})
}
