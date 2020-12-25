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
    GraphQL: ast.TypeNode & {arg?: ast.TypeNode}
  }
  interface _Alg<T extends Target, I extends Input> {
    gqlResolver: <Parent, Args, Context, Output>(i: lib.InputOf<"gqlResolver", I, Output> & {
      parent: Result<T, Parent>, args: lib.DictArgs<T, I, Args>,
      context: Result<T, Context>, output: Result<T, Output>}) =>
      Result<T, (parent: Parent, args: Args, context: Context) => Promise<Output>>
    gqlScalar: <A>(i: lib.InputOf<"gqlScalar", I, A> & {
      config: def.GraphQLScalarTypeConfig<A, any> }) => Result<T, A>
  }
}

const gqlScalar = (tpe: string): ast.TypeDefinitionNode =>
  ({"kind": "ScalarTypeDefinition",
    "name": {"kind": "Name", "value": tpe}})

const gqlPrim = (tpe: string): ast.NonNullTypeNode =>
  ({"kind": "NonNullType",
    "type": {"kind": "NamedType", "name": {"kind": "Name", "value": tpe,}}})

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

const field = (name: string, node: ast.TypeNode & {arg?: ast.TypeNode}):
ast.FieldDefinitionNode =>
  ({kind: "FieldDefinition",
    name: {kind: "Name", value: name},
    arguments: node.arg ? [arg(node.arg)] : [],
    type: node})

const inputField = (name: string, node: ast.TypeNode):
ast.InputValueDefinitionNode =>
  ({kind: "InputValueDefinition",
    name: {kind: "Name", value: name},
    type: node})

type GQLAlg = lib.Alg<URI,
  "str" | "num" | "nullable" | "array" | "bool" |
  "recurse" | "dict" | "gqlResolver" | "gqlScalar",
  URI>

export const GQL: () => GQLAlg & {
  definitions: () => ast.TypeDefinitionNode[],
  scalars: () => {[key: string]: def.GraphQLScalarType}} = () => {
  let definitions: {[key: string]: ast.TypeDefinitionNode} = {}
  let scalars: {[key: string]: def.GraphQLScalarType} = {}
  const _cache: {[key: string]: ast.TypeNode} = {}
  const memNamed = lib.memo(_cache)
  const input = <T>({GraphQL: {Named}, props: mkProps}: lib.DictArgs<URI, URI, T>) => {
    if (Named in _cache) return _cache[Named]
    const ret = memNamed(Named, () => gqlPrim(Named))
    const props = mkProps()
    definitions[Named] = inputObject(Named, Object.keys(props)
      .map(k => inputField(k, props[k as keyof lib.Props<URI, T>])))
    return ret
  }
  return {
    definitions: () => Object.keys(definitions).map(k => definitions[k]),
    scalars: () => ({...scalars}),
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
    gqlResolver: ({parent: p, args: a, context: c, output: o}) => ({...o, arg: input(a)}),
    dict: <T>({GraphQL: {Named}, props: mkProps}: lib.DictArgs<URI, URI, T>) => {
      if (Named in _cache) return _cache[Named]
      const ret = memNamed(Named, () => gqlPrim(Named))
      const props = mkProps()
      definitions[Named] = object(Named, Object.keys(props)
        .map(k => field(k, props[k as keyof lib.Props<URI, T>])))
      return ret
    }
  }
};

