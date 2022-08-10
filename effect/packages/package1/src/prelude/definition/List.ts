import { pipe } from "../../primitives";
import { LazyArgument } from "../../utils/LazyArgument";

/**
 * @tsplus type tsplus-tests/List/Cons
 */
export class Cons<A> implements Iterable<A> {
  readonly _A!: () => A;
  constructor(readonly array: readonly A[]) {}

  [Symbol.iterator]!: () => Iterator<A>;
}

/**
 * @tsplus type tsplus-tests/List/Nil
 */
export class Nil<A> implements Iterable<A> {
  readonly _A!: () => A;
  readonly array = [];
  [Symbol.iterator]!: () => Iterator<A>;
}

/**
 * @tsplus type tsplus-tests/List
 */
export type List<A> = Nil<A> | Cons<A>;

/**
 * @tsplus type tsplus-tests/ListOps
 */
export interface ListOps {}

export const List: ListOps = {};

/**
 * @tsplus unify tsplus-tests/List/Cons
 * @tsplus unify tsplus-tests/List/Nil
 */
export function unifyList<X extends List<any>>(
  self: X
): List<[X] extends [{ _A: () => infer A }] ? A : never> {
  return self;
}

/**
 * @tsplus index tsplus-tests/List
 */
export function indexAt<A>(self: List<A>, index: number): A | undefined {
  return self.array[index];
}

/**
 * @tsplus static tsplus-tests/ListOps from
 * @tsplus static tsplus-tests/ListOps __call
 */
export function make<As extends readonly any[]>(...as: As): List<As[number]> {
  return new Cons(as);
}

pipe(List.from(1, 2, 3), List.from);

/**
 * Concatenates `List<A>` and `List<B>`
 * @tsplus operator tsplus-tests/List +
 * @tsplus fluent tsplus-tests/List concat
 */
export function concat<A>(self: List<A>, that: List<A>): List<A> {
  return new Cons([...self.array, ...that.array]);
}

/**
 * Prepends `a: A` to `List<A>`
 * @tsplus operator tsplus-tests/List +
 */
export function prependTo<A>(a: A, self: List<A>): List<A> {
  return new Cons([a, ...self.array]);
}

/**
 * Prepends `a: A` to `List<A>`
 * @tsplus fluent tsplus-tests/List prepend
 */
export function prepend<A>(self: List<A>, a: A): List<A> {
  return new Cons([a, ...self.array]);
}

/**
 * Appends `a: A` to `List<A>`
 * @tsplus operator tsplus-tests/List +
 * @tsplus fluent tsplus-tests/List append
 */
export function append_<A>(self: List<A>, a: A): List<A> {
  return new Cons([...self.array, a]);
}

/**
 * @tsplus fluent Iterable flatMap
 */
export function iterableFlatMap_<A, B>(
  self: Iterable<A>,
  f: (a: A) => Iterable<B>
): Iterable<B> {
  return {
    *[Symbol.iterator]() {
      for (const a of self) {
        yield* f(a);
      }
    },
  };
}

/**
 * @tsplus fluent tsplus-tests/List flatMap
 */
export function flatMap_<A, B>(self: List<A>, f: (a: A) => List<B>): List<B> {
  return new Cons(self.array.flatMap((a) => f(a).array));
}

export const append = Pipeable(append_);

export const prepended = 1 + List(0); // prepend
export const appended = List(0) + 1; // append
export const sequenced = List(0) + List(1); // concat

export const flatMapped = List(0, 1, 2).flatMap((n) => [n + 1, n + 2, n + 3]); // iterableFlatMap_

function appending() {
  let x = List(0);
  for (let j = 0; j < 10; j++) {
    x = x + 1;
  }
}

function i<A>(l: LazyArgument<A>) {
  return l();
}

const x = i(make(0));
