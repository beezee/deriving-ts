# derive-ts

derive-ts is heavily inspired by morphic-ts and io-ts.

### Goals

The primary goals for this library are:

1) Easy addition of support for new types in application code
2) Easy addition of new interpreters in application code
3) Program declarations use minimal algebra _required for the program_
4) Programs can provide interpreter specific inputs for zero or more interpreters per type
5) Programs can be reasonably defined to support composition and manipulation of declarations
6) Interpreter definitions cover minimal algebra _supported by the interpreter_
7) Interpreters can accept or require interpreter specific inputs from programs
8) Interpreters can be reasonably defined to support composition and manipulation of definitions 

### Adding support for new types

### Adding new interpreters

### Declaring algebras for programs

### Providing interpreter-specific inputs to programs

### Composing and manipulating program declarations

### Defining interpreters for algebras

### Supporting and requiring interpreter specific inputs from programs

### Composing and manipulating interpreter definitions

### Background

io-ts and morphic-ts provide a great set of functionality towards type-directed generic derivation 
of programs in typescript, both using a finally-encoded approach.

While final encoding seems to play nicely with the quirks and limitations of the typescript 
compiler, it can cause some friction with composition and re-use of programs written using 
the provided DSLs. Namely, because there is no reified value representing the definition of a 
program, special care must be taken to allow programs to be composed and manipulated in 
meaningful ways _prior_ to their interpretation in their "target languages."

After hitting a [wall](https://github.com/microsoft/TypeScript/issues/13995) in a considerable effort to solve for generic derivation using an [initially-encoded approach](https://tinyurl.com/y4mck6ea), io-ts and morphic-ts provided great insight into the finally-encoded approach. A desire to preserve as much of the flexibility offered by an initial encoding as possible during the pivot has led to the architectural choices in this library.

#### How to build TypeScript mono-repo project
[![CircleCI](https://circleci.com/gh/Quramy/lerna-yarn-workspaces-example.svg?style=svg)](https://circleci.com/gh/Quramy/lerna-yarn-workspaces-example)

Built from [this starter](https://github.com/Quramy/lerna-yarn-workspaces-example.git)
