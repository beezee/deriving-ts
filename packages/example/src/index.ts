import * as lib from '@deriving-ts/core';
import * as gqld from '@deriving-ts/graphql';
import * as fastcheck from '@deriving-ts/fast-check';
import * as fc from 'fast-check';
import * as prand from 'pure-rand';
import { ApolloServer, gql } from 'apollo-server';
import { buildASTSchema, printSchema } from 'graphql';


type Ops = "dict" | "array" | "str"
type Inputs = "GraphQL" | "FastCheck"
type Alg<F extends lib.Target> = lib.Alg<F, Ops, Inputs>

const bookProps = <F extends lib.Target>(T: Alg<F>) => ({
  title: T.str({FastCheck: {type: "lorem"}}),
  author: T.str({FastCheck: {type: "lorem"}}) })

const Book = <F extends lib.Target>(T: Alg<F>) =>
  T.dict({GraphQL: {Named: "Book"}, props: () => bookProps(T)})
const BookType = Book(lib.Type)
type Book = lib.TypeOf<typeof BookType>

const arbBooks: fc.Arbitrary<Book[]> = fc.array(Book(fastcheck.FastCheck())(3))
const books = arbBooks.generate(new fc.Random(prand.mersenne(17)))

type GqlAlg<F extends lib.Target> = lib.Alg<F, Ops | "gqlResolver", Inputs>
const queryProps = <F extends lib.Target>(T: GqlAlg<F>) => ({
  books: T.gqlResolver({
    parent: T.dict({GraphQL: {Named: "Query"}, props: () => ({})}),
    context: T.dict({GraphQL: {Named: 'Context'}, props: () => ({foo: T.str({})})}),
    args: {GraphQL: {Named: "BooksQueryInput"}, props: () => ({foo: T.str({})})},
    output: T.array({of: Book(T)})})
})

const Query = <F extends lib.Target>(T: GqlAlg<F>) =>
  T.dict({GraphQL: {Named: "Query"}, props: () => queryProps(T)})
const QueryType = Query(lib.Type)
type Query = lib.TypeOf<typeof QueryType>

const query: Query = { books: () => Promise.resolve(books.value) }

const Gql = gqld.GQL()

Query(Gql)
const typeDefs = {kind: "Document" as const, definitions: Gql.definitions()}

const server = new ApolloServer({ typeDefs, resolvers: {Query: query} })

server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
