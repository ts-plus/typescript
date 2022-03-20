/**
 * @tsplus type tsplus-tests/List
 * @tsplus companion tsplus-tests/ListOps
 */
export class List<A> {
    constructor(readonly array: readonly A[]) { }
}

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
    return new List(as)
}

/**
 * @tsplus operator tsplus-tests/List +
 * @tsplus fluent tsplus-tests/List concat
 */
export function concat<A, B>(self: List<A>, that: List<B>): List<A | B> {
    return new List([...self.array, ...that.array])
}

/**
 * Prepends `a: B` to `List<A>`
 * @tsplus operator tsplus-tests/List +
 */
export function prependTo<A, B>(a: A, self: List<B>): List<A | B> {
    return new List([a, ...self.array])
}

/**
 * @tsplus fluent tsplus-tests/List prepend
 */
export function prepend<A, B>(self: List<A>, a: B): List<A | B> {
    return new List([a, ...self.array])
}

/**
 * @tsplus operator tsplus-tests/List +
 * @tsplus fluent tsplus-tests/List append
 */
export function append<A, B>(self: List<A>, a: B): List<A | B> {
    return new List([...self.array, a])
}

export const prepended = 1 + List(0)
export const appended = List(0) + 1
export const sequenced = List(0) + List(1)