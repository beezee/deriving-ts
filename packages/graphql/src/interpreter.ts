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
    GraphQL: ast.TypeNode | ast.TypeDefinitionNode
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

const option = (node: ast.TypeNode | ast.TypeDefinitionNode) =>
  node.kind === "NonNullType" ? node.type : node

function isTypeNode(x: ast.TypeNode | ast.TypeDefinitionNode): x is ast.TypeNode {
  return "kind" in x && (["NamedType", "ListType", "NonNullType"].indexOf(x.kind) >= 0)
}

const list = (node: ast.TypeNode | ast.TypeDefinitionNode): ast.TypeNode | ast.TypeDefinitionNode =>
  isTypeNode(node)
    ? ({kind: "NonNullType", type: {kind: "ListType", type: node}})
    : node

const object = (name: string, fields: ast.FieldDefinitionNode[]): ast.ObjectTypeDefinitionNode =>
  ({kind: "ObjectTypeDefinition",
    name: {kind: "Name", value: name},
    fields})

const arg = (node: ast.TypeDefinitionNode) =>
  ({kind: "InputValueDefinition" as const,
    name: {kind: "Name" as const, value: "input"},
    type: gqlPrim(node.name.value)})

const field = (name: string, node: ast.TypeNode | ast.TypeDefinitionNode):
ast.FieldDefinitionNode =>
  ({kind: "FieldDefinition",
    name: {kind: "Name", value: name},
    arguments: ((<any>node).arg ? [arg((<any>node).arg)] : []),
    type: isTypeNode(node)
      ? node : gqlPrim(node.name.value)})

type GQLAlg = lib.Alg<URI,
  "str" | "num" | "nullable" | "array" | "bool" |
  "recurse" | "dict" | "gqlResolver" | "gqlScalar",
  URI>

export const GQL: () => GQLAlg & {
  definitions: () => ast.TypeDefinitionNode[],
  scalars: () => def.GraphQLScalarType[]} = () => {
  let definitions: ast.TypeDefinitionNode[] = []
  let scalars: def.GraphQLScalarType[] = []
  const _cache: Record<string, ast.TypeDefinitionNode> = {}
  const cache = lib.memo(_cache)
  const mem = (id: string, fn: () => ast.TypeNode | ast.TypeDefinitionNode):
  ast.TypeNode | ast.TypeDefinitionNode => cache(id, fn)
  const dict = <T>({GraphQL: {Named}, props: mkProps}: lib.DictArgs<URI, URI, T>) => {
    if (Named in _cache) return _cache[Named]
    mem(Named, () => gqlPrim(Named))
    const props = mkProps()
    const res = object(Named, Object.keys(props)
      .map(k => field(k, props[k as keyof lib.Props<URI, T>] as ast.TypeNode)))
    definitions.push(res)
    return res
  }
  return {
    definitions: () => definitions.slice(),
    scalars: () => scalars.slice(),
    str: (i) => gqlPrim(i.GraphQL?.type || 'String'),
    bool: () => gqlPrim('Boolean'),
    num: (i) => gqlPrim(i.GraphQL?.type || "Int"),
    nullable: ({of}) => option(of),
    array: ({of}) => list(of),
    recurse: (id, f, map = (x) => x) => map(mem(id, f)),
    gqlScalar: ({config: i}) => {
      if (i.name in _cache) return _cache[i.name]
      mem(i.name, () => gqlPrim(i.name))
      scalars.push(new GraphQLScalarType(i))
      definitions.push(gqlScalar(i.name))
      return _cache[i.name]
    },
    gqlResolver: ({parent: p, args: a, context: c, output:o}) => ({...o, arg: dict(a)}),
    dict
  }
};

