import * as lib from '@deriving-ts/core';
import * as gqld from '@deriving-ts/graphql';
import * as fastcheck from '@deriving-ts/fast-check';
import * as fc from 'fast-check';
import * as prand from 'pure-rand';
import * as def from 'graphql/type/definition';
import { SafeIntResolver as SafeInt } from 'graphql-scalars';
import { ApolloServer } from 'apollo-server';


type Ops = "dict" | "array" | "str" | "bool" | "num" | "sum"
type Inputs = "GraphQL" | "FastCheck"
type Alg<F extends lib.Target> = lib.Alg<F, Ops, Inputs>

const bookProps = <F extends lib.Target>(T: Alg<F>) => ({
  ID: T.str({FastCheck: {type: "uuid"}, GraphQL: {type: "ID"}}),
  title: T.str({FastCheck: {type: "lorem"}}),
  author: T.str({FastCheck: {type: "lorem"}}) })

const Book = <F extends lib.Target>(T: Alg<F>) =>
  T.dict({GraphQL: {Named: "Book"}, props: () => bookProps(T)})
const BookType = Book(lib.Type)
type Book = lib.TypeOf<typeof BookType>

const videoProps = <F extends lib.Target>(T: Alg<F>) => {
  const {ID, title, author: producer} = bookProps(T)
  return {ID, title, producer}
}

const Video = <F extends lib.Target>(T: Alg<F>) =>
  T.dict({GraphQL: {Named: "Video"}, props: () => videoProps(T)})
const VideoType = Video(lib.Type)
type Video = lib.TypeOf<typeof VideoType>

const Media = <F extends lib.Target>(T: Alg<F>) =>
  T.sum({GraphQL: {Named: "Media"}, key: "type",
    props: {Book: Book(T), Video: Video(T)}})
const MediaType = Media(lib.Type)
type Media = lib.TypeOf<typeof MediaType>

const arbMedia: fc.Arbitrary<Media[]> =
  fastcheck.FastCheck().array({
    FastCheck: {minLength: 2, maxLength: 10},
    of: Media(fastcheck.FastCheck())})(3)
const media = (s: number): Media[] => arbMedia.generate(new fc.Random(prand.mersenne(s))).value

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

const GqlMedia = <F extends lib.Target>(T: GqlAlg<F>) =>
  T.sum({GraphQL: {Named: "Media"}, key: "type",
    props: {Book: GqlBook(T), Video: Video(T)}})

const PosInt = <F extends lib.Target>(T: GqlAlg<F>) =>
  T.gqlScalar({config: (<def.GraphQLScalarTypeConfig<string | number, any>>SafeInt)})

const queryProps = <F extends lib.Target>(T: GqlAlg<F>) => ({
  media: T.gqlResolver({
    parent: T.dict({GraphQL: {Named: "Query"}, props: () => ({})}),
    context: Context(T),
    args: {GraphQL: {Named: "MediaQueryInput"}, props: () => ({seed: T.num({})})},
    output: T.array({of: GqlMedia(T)}),
    resolve: (_, {input: {seed}}) => Promise.resolve(media(seed))})
})

const Query = <F extends lib.Target>(T: GqlAlg<F>) =>
  T.dict({GraphQL: {Named: "Query"}, props: () => queryProps(T)})

const schema = gqld.BuildSchema({Query})

const server = new ApolloServer({...schema, cacheControl: false })

server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
