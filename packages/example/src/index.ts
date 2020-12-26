import * as lib from '@deriving-ts/core';
import * as gqld from '@deriving-ts/graphql';
import * as fastcheck from '@deriving-ts/fast-check';
import * as fc from 'fast-check';
import * as prand from 'pure-rand';
import * as def from 'graphql/type/definition';
import { SafeIntResolver as SafeInt } from 'graphql-scalars';
import { ApolloServer, gql } from 'apollo-server';
import { buildASTSchema, printSchema } from 'graphql';


type Ops = "dict" | "array" | "str" | "bool" | "num"
type Inputs = "GraphQL" | "FastCheck"
type Alg<F extends lib.Target> = lib.Alg<F, Ops, Inputs>

const bookProps = <F extends lib.Target>(T: Alg<F>) => ({
  title: T.str({FastCheck: {type: "lorem"}}),
  author: T.str({FastCheck: {type: "lorem"}}) })

const Book = <F extends lib.Target>(T: Alg<F>) =>
  T.dict({GraphQL: {Named: "Book"}, props: () => bookProps(T)})
const BookType = Book(lib.Type)
type Book = lib.TypeOf<typeof BookType>

const arbBooks: fc.Arbitrary<Book[]> = 
  fc.array(Book(fastcheck.FastCheck())(3), 2, 4)
const books = (s: number): Book[] => arbBooks.generate(new fc.Random(prand.mersenne(s))).value

type GqlAlg<F extends lib.Target> = lib.Alg<F, 
  Ops | "gqlResolver" | "gqlScalar" | "dictWithResolvers", Inputs>

const Context = <F extends lib.Target>(T: GqlAlg<F>) =>
  T.dict({GraphQL: {Named: "Context"}, props: () => ({foo: T.str({})})})

const GqlBook = <F extends lib.Target>(T: GqlAlg<F>) =>
  T.dictWithResolvers({GraphQL: {Named: "Book"}, props: () => bookProps(T)},
    {resolvers: () => ({ 
      titleLength: T.gqlResolver({
        parent: Book(T),
        args: {GraphQL: {Named: "BookAvailableInput"}, props: () => ({max: T.num({})})},
        context: Context(T),
        output: T.num({}),
        resolve: ({title}, {input: {max}}) => Promise.resolve(Math.min(max, title.length))
      })})})

const PosInt = <F extends lib.Target>(T: GqlAlg<F>) =>
  T.gqlScalar({config: (<def.GraphQLScalarTypeConfig<string | number, any>>SafeInt)})

const queryProps = <F extends lib.Target>(T: GqlAlg<F>) => ({
  books: T.gqlResolver({
    parent: T.dict({GraphQL: {Named: "Query"}, props: () => ({})}),
    context: T.dict({GraphQL: {Named: 'Context'}, props: () => ({foo: T.str({})})}),
    args: {GraphQL: {Named: "BooksQueryInput"}, props: () => ({seed: T.num({})})},
    output: T.array({of: GqlBook(T)}),
    resolve: (_, {input: {seed}}) => Promise.resolve(books(seed))})
})

const Query = <F extends lib.Target>(T: GqlAlg<F>) =>
  T.dict({GraphQL: {Named: "Query"}, props: () => queryProps(T)})

const schema = gqld.BuildSchema({Query})

const server = new ApolloServer({...schema, cacheControl: false })

server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
