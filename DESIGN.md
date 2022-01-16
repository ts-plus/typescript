# Lazy Function Arguments

Given a function like:
```ts
function f(a: LazyArgument<A>): A { 
    return a()
}
```

any call expression to `f(arg)` will be implicitly considered `f(() => arg)` if `arg` isn't already lazy (extends `() => A`)

# Companion Namespaces
Given an interface type `export interface F<_> {}`
1) define a companion namespace using:
    ```ts
    export declare namespace F {}
    ```
    note that it is fundamental to use the same name as the interface and to use the `declare` keyword so that the namespace is only defined at the type level.
2) define constructors as functions:
    ```ts
    export interface IO<A> {}
    export declare namespace IO {}

    /**
     * @ets_constructor succeed
     */
    export function succeed<A>(io: LazyArgument<A>): IO<A> {
        /// implementation
    }
    ```
3) use constructors:
    ```ts
    IO.succeed(console.log("hello world"))
    ```

# Extension Methods
Given an interface type `interface F<_> {}` 

1) define extension extension methods as either:
    - Data First Function:
    ```ts
    interface IO<A> {}

    /**
     * @ets_extension map
     */
    function map<A, B>(self: IO<A>, f: (a: A) => B): IO<B> {
        // implementation
    }
    ```
    - Pipeable Function:
    ```ts
    interface IO<A> {}

    /**
     * @ets_extension map
     */
    function map<A, B>(f: (a: A) => B): (self: IO<A>) => IO<B> {
        // implementation
    }
    ```
    
2) use extension methods:
    ```ts
    IO.succeed(0).map((n) => n + 1)
    ```

Note, if both a data-first and a pipeable methods are found the data-first is preferentially picked in compilation stage it is the optimal case for performance.

# DataFirst Helper
Given a pipeable function `f` a data first function can be generated using `DataFirst`.

if the function `f` is an extension method the documentation comment is copied.

if `DataFirst` appears in the following statement of the declaration of `f` the implementation is inlined and the implementation of `f` replaced in terma of its data-first optimized variant.

namely:

```ts
export interface IO<A> {}

/**
 * Maps the result of IO using f
 * 
 * @ets_extension map
 */
export function map<A, B>(f: (a: A) => B): (self: IO<A>) => IO<B> {
    // implementation
}

export const map_ = DataFirst(map)
```

will become:

```ts
export interface IO<A> {}

/**
 * Maps the result of IO using f
 * 
 * @ets_extension map
 */
export function map<A, B>(f: (a: A) => B): (self: IO<A>) => IO<B> {
    return self => map_(self, g)
}

/**
 * Maps the result of IO using f
 * 
 * @ets_extension map
 */
export function map_<A, B>(self: IO<A>, f: (a: A) => B): IO<B> {
    // implementation
}
```

# Extension Getters
Given an interface type `interface F<_> {}` 

1) define a function:
    ```ts
    /**
     * @ets_getter unsafeRun
     */
    function unsafeRun<A>(self: IO<A>): A {
        // implementation
    }
    ```
2) use the getter:
    ```ts
    const result = IO.succeed(0).map((n) => n + 1).unsafeRun
    ```

# Operators Overloading
Given an interface type `interface F<_> {}` 

1) define a binay extension method:
    ```ts
    export interface IO<A> {}

    /**
    * Maps the result of IO using f
    * 
    * @ets_extension map
    * @ets_operator +
    */
    export function zip<A, B>(that: IO<B>): <A>(self: IO<A>) => IO<[A, B]> {
        return self => map_(self, g)
    }

    // OR

    /**
    * Maps the result of IO using f
    * 
    * @ets_extension map
    * @ets_operator +
    */
    export function zip_<A, B>(self: IO<A>, that: IO<B>): IO<[A, B]> {
        // implementation
    }
    ```
2) use operator:
    ```ts
    const result = IO.succeed(0) + IO.succeed(1)
    ```

# Source File Scope
Each source file has access to all the extensions and constructors that are:
1) defined in the same source file
2) defined in one of the imported modules
3) defined recursively in one of the namespace exports of an imported module

Namely a file `x.ts`:

```ts
import {} from "./a"
```

where `a.ts` is:

```ts
export * as x from "./b"
// maybe additional exported functions
```

has access to all the symbols exported in either `b.ts` and all the symbols of `a.ts`.

Note that in case your target requires tree-shacking using older bundlers like `webpack4` that don't support deep scope analysis you should make sure not to use namespace re-exports as they will prevent tree-shaking.

When compiled each import is translated to a namespace import like:
```ts
import {} from "./a"
```
will get a compound
```ts
import * as module_n from "./a"
```
and symbols will be accessed using property access expressions like
```ts
module_n.map()
module_n.x.map()
module_n.x.y.map()
```

# Implicit Arguments

To define an implicit argument in a function use the following pattern:

```ts
/**
 * @ets_getter mapM
 */
function mapM<A>(self: Array<A>): <F>(F: Implicit<Applicative<F>>) => <R, E>(f: (a: A) => Kind<F, R, E, A>) => Kind<F, R, E, Array<A>> {
    // implementation
}
```

then define implicit instances like:

```ts
/**
 * @ets_implicit
 */
export const EffectApplicative: Applicative<EffectHKT>
```

and use it like:

```ts
[0, 1, 2].mapM((n) => T.succeed(n + 1))
```

when a call-expression of the following kind gets resolved:

```ts
[0, 1, 2].mapM()
```

the type of `[0, 1, 2].mapM` is checked, in this case the getter `mapM` and if the first parameter is an implicit, in this case `Applicative<F>`, instances are discovered and each participate in an additional overload available.

the base overload remains available for custom instances to be provided like:

```ts
[0, 1, 2].mapM(EffectApplicativePar)((n) => T.succeed(n + 1))
```

Note: `Implicit` is defined as:

```ts
type Implicit<A> = A
```

so it is non-invasive in usage outside the compiler extension.
