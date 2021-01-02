import * as lib from '@deriving-ts/core';
import * as gqld from '@deriving-ts/graphql';
import * as fastcheck from '@deriving-ts/fast-check';
import * as fc from 'fast-check';
import * as prand from 'pure-rand';
import * as def from 'graphql/type/definition';
import { SafeIntResolver as SafeInt } from 'graphql-scalars';
import { ApolloServer } from 'apollo-server';


type Ops = "dict" | "array" | "str" | "bool" | "num" | "sum" | "nullable"
type Inputs = "GraphQL" | "FastCheck"
type Alg<F extends lib.Target> = lib.Alg<F, Ops, Inputs>

const makeOptional = <F extends lib.Target, A>(T: Alg<F>, props: lib.Props<F, A>):
lib.Props<F, {[k in keyof A]: A[k] | null}> =>
  Object.keys(props).reduce((acc, k) => ({...acc, 
    [k]: T.nullable({of: props[k as keyof A]})}),
    {} as lib.Props<F, {[k in keyof A]: A[k] | null}>)

const bookProps = <F extends lib.Target>(T: Alg<F>) => ({
  ID: T.str({FastCheck: {type: "uuid"}, GraphQL: {type: "ID"}}),
  title: T.str({FastCheck: {type: "lorem"}}),
  author: T.str({FastCheck: {type: "lorem"}}) })

const Book = <F extends lib.Target>(T: Alg<F>) =>
  T.dict({GraphQL: {Named: "Book"}, props: () => bookProps(T)})
const BookType = Book(lib.Type)
type Book = lib.TypeOf<typeof BookType>

const UpdateBook = <F extends lib.Target>(T: Alg<F>) => {
  const {ID, ...rest} = bookProps(T)
  return {
    GraphQL: {Named: "UpdateBook"},
    props: () => ({ID, ...makeOptional(T, rest)})
  }
}

const videoProps = <F extends lib.Target>(T: Alg<F>) => {
  const {ID, title, author: producer} = bookProps(T)
  return {ID, title, producer}
}

const Video = <F extends lib.Target>(T: Alg<F>) =>
  T.dict({GraphQL: {Named: "Video"}, props: () => videoProps(T)})
const VideoType = Video(lib.Type)
type Video = lib.TypeOf<typeof VideoType>

const UpdateVideo = <F extends lib.Target>(T: Alg<F>) => {
  const {ID, ...rest} = videoProps(T)
  return {
    GraphQL: {Named: "UpdateVideo"},
    props: () => ({ID, ...makeOptional(T, rest)})
  }
}

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
const genBooks = (s: number): Book[] => media(s).reduce(
  (acc, e) => [...acc, ...((e.type === "Book") ? [e] : [])], [] as Book[])
const genVideos = (s: number): Video[] => media(s).reduce(
  (acc, e) => [...acc, ...((e.type === "Video") ? [e] : [])], [] as Video[])

type GqlAlg<F extends lib.Target> = lib.Alg<F, 
  Ops | "gqlResolver" | "gqlScalar" | "dictWithResolvers", Inputs>

interface Repo<A> {
  all: () => A[]
  get: (id: string) => A | null
  save: (a: A) => void
  seed: (a: A[]) => void
}
type Context = { books: Repo<Book>, videos: Repo<Video> }

const books: {[key: string]: Book} = {}
const videos: {[key: string]: Video} = {}
const repo = <A extends {ID: string}>(db: {[key: string]: A}): Repo<A> => ({
  all: () => Object.keys(db).reduce((acc, e) => [...acc, db[e]], [] as A[]),
  get: (id: string) => (id in db) ? db[id] : null,
  save: (a: A) => { db[a.ID] = a },
  seed: (seed: A[]) => 
    seed.forEach(e => { if (!(e.ID in db)) db[e.ID] = e })
})

const context: Context = { books: repo(books), videos: repo(videos) }
context.books.seed(genBooks(7))
context.videos.seed(genVideos(7))

const GqlBook = <F extends lib.Target>(T: GqlAlg<F>) =>
  T.dictWithResolvers("Book", {props: () => bookProps(T)},
    {resolvers: () => ({ 
      titleLength: T.gqlResolver({
        parent: Book(T),
        args: {GraphQL: {Named: "BookAvailableInput"}, props: () => ({max: T.num({})})},
        context: lib.type<Context>(),
        output: T.num({})
      })})})

const GqlBookType = GqlBook(lib.Type)
type BookResolvers = typeof GqlBookType.resolvers
const BookResolvers: BookResolvers = {
  Book: {
    titleLength: ({title}, {input: {max}}) => Promise.resolve(Math.min(max, title.length))
  }
}



const GqlMedia = <F extends lib.Target>(T: GqlAlg<F>) =>
  T.sum({GraphQL: {Named: "Media"}, key: "type",
    props: {Book: GqlBook(T).result, Video: Video(T)}})

const PosInt = <F extends lib.Target>(T: GqlAlg<F>) =>
  T.gqlScalar({config: (<def.GraphQLScalarTypeConfig<string | number, any>>SafeInt)})

const queryProps = <F extends lib.Target>(T: GqlAlg<F>) => ({
  media: T.gqlResolver({
    parent: T.dict({GraphQL: {Named: "Query"}, props: () => ({})}),
    context: lib.type<Context>(),
    args: null,
    output: T.array({of: GqlMedia(T)})})
})

const Query = <F extends lib.Target>(T: GqlAlg<F>) =>
  T.dictWithResolvers("Query", {props: () => ({})},
    {resolvers: () => queryProps(T)})

const QueryType = Query(lib.Type)
type QueryResolvers = typeof QueryType.resolvers
const QueryResolvers: QueryResolvers = {
  Query: {
    media: (_, __, context) => Promise.resolve(
      [...context.books.all().map(x => ({...x, type: "Book" as const})),
       ...context.videos.all().map(x => ({...x, type: "Video" as const}))])
  }
}

const coalesce = <A>(l: A | null, r: A) =>
  l === null || undefined ? r : l

const mutationProps = <F extends lib.Target>(T: GqlAlg<F>) => ({
  seed: T.gqlResolver({
    parent: T.dict({GraphQL: {Named: "Mutation"}, props: () => ({})}),
    context: lib.type<Context>(),
    args: {GraphQL: {Named: "SeedInput"}, props: () => ({seed: T.num({})})},
    output: T.bool({})}),
  updateBook: T.gqlResolver({
    parent: T.dict({GraphQL: {Named: "Mutation"}, props: () => ({})}),
    context: lib.type<Context>(),
    args: UpdateBook(T),
    output: GqlBook(T).result}),
  updateVideo: T.gqlResolver({
    parent: T.dict({GraphQL: {Named: "Mutation"}, props: () => ({})}),
    context: lib.type<Context>(),
    args: UpdateVideo(T),
    output: Video(T)})
})

const Mutation = <F extends lib.Target>(T: GqlAlg<F>) =>
  T.dictWithResolvers("Mutation", {props: () => ({})},
    {resolvers: () => mutationProps(T)})

const MutationType = Mutation(lib.Type)
type MutationResolvers = typeof MutationType.resolvers
const MutationResolvers: MutationResolvers = {
  Mutation: {
    seed: (_, {input: {seed}}, context) => {
      context.books.seed(genBooks(seed))
      context.videos.seed(genVideos(seed))
      return Promise.resolve(true)
    },
    updateBook: (_, {input: {ID, ...rest}}, context) => {
      const existing = context.books.get(ID)
      if (!existing) return Promise.reject(new Error(`No book found with ID ${ID}`))
      const update = {
        ...Object.keys(rest).reduce((acc, k) => 
          ({...acc, [k]: coalesce(
            rest[k as Exclude<"ID", keyof Book>], existing[k as keyof Book])}),
          {...existing}), ID: existing.ID}
      context.books.save(update)
      return Promise.resolve(update)
    },
    updateVideo: (_, {input: {ID, ...rest}}, context) => {
      const existing = context.videos.get(ID)
      if (!existing) return Promise.reject(new Error(`No video found with ID ${ID}`))
      const update = {
        ...Object.keys(rest).reduce((acc, k) => 
          ({...acc, [k]: coalesce(
            rest[k as Exclude<"ID", keyof Video>], existing[k as keyof Video])}),
          {...existing}), ID: existing.ID}
      context.videos.save(update)
      return Promise.resolve(update)
    }
  }
}

const schema = gqld.BuildSchema([Query, Mutation],
  [QueryResolvers, MutationResolvers, BookResolvers])

const server = new ApolloServer({...schema, cacheControl: false, context })

server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
