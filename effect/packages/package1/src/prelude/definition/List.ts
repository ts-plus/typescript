export class Cons<A> implements Iterable<A> {
    constructor(readonly array: readonly A[]) { }

    [Symbol.iterator]!: () => Iterator<A>
}

export class Nil<A> implements Iterable<A> {
    readonly _A!: () => A;
    readonly array = [];
    [Symbol.iterator]!: () => Iterator<A>
}

/**
 * @tsplus type tsplus-tests/List
 */
export type List<A> = Nil<A> | Cons<A>

/**
 * @tsplus type tsplus-tests/ListOps
 */
export interface ListOps {}

export const List: ListOps = {};

/**
 * @tsplus unify tsplus-tests/List
 */
export function unifyList<X extends List<any>>(self: X): List<
    [X] extends [List<infer A>] ? A : never
> {
    return self
}

/**
 * @tsplus index tsplus-tests/List
 */
export function indexAt<A>(self: List<A>, index: number): A | undefined {
    return self.array[index]
}

/**
 * @tsplus static tsplus-tests/ListOps __call
 */
export function make<As extends readonly any[]>(...as: As): List<As[number]> {
    return new Cons(as)
}

/**
 * Concatenates `List<A>` and `List<B>`
 * @tsplus operator tsplus-tests/List +
 * @tsplus fluent tsplus-tests/List concat
 */
export function concat<A>(self: List<A>, that: List<A>): List<A> {
    return new Cons([...self.array, ...that.array])
}

/**
 * Prepends `a: A` to `List<A>`
 * @tsplus operator tsplus-tests/List +
 */
export function prependTo<A>(a: A, self: List<A>): List<A> {
    return new Cons([a, ...self.array])
}

/**
 * Prepends `a: A` to `List<A>`
 * @tsplus fluent tsplus-tests/List prepend
 */
export function prepend<A>(self: List<A>, a: A): List<A> {
    return new Cons([a, ...self.array])
}

/**
 * Appends `a: A` to `List<A>`
 * @tsplus operator tsplus-tests/List +
 * @tsplus fluent tsplus-tests/List append
 */
export function append<A>(self: List<A>, a: A): List<A> {
    return new Cons([...self.array, a])
}

export const prepended = 1 + List(0) // prepend
export const appended = List(0) + 1 // append
export const sequenced = List(0) + List(1) // concat
