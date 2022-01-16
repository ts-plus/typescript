import { die } from '@effect-ts/core/Effect';
import { Predicate, Refinement } from '@effect-ts/core/Function';
import { LazyArgument } from '../../utils/LazyArgument';
import { Effect } from '../definition/Effect';

/**
 * @tsplus pipeable ets/Effect filterOrElse
 */
export declare function filterOrElse<A, B extends A, R2, E2, A2>(p: Refinement<A, B>, or: (a: Exclude<A, B>) => Effect<R2, E2, A2>, __trace?: string): <R, E>(fa: Effect<R, E, A>) => Effect<R & R2, E | E2, B | A2>;
export declare function filterOrElse<A, R2, E2, A2>(p: Predicate<A>, or: (a: A) => Effect<R2, E2, A2>, __trace?: string): <R, E>(fa: Effect<R, E, A>) => Effect<R & R2, E | E2, A | A2>;

export function filterOrDie<A, B extends A>(p: Refinement<A, B>, dieWith: LazyArgument<unknown>, __trace?: string): <R, E>(fa: Effect<R, E, A>) => Effect<R, E, B>;
export function filterOrDie<A>(p: Predicate<A>, dieWith: LazyArgument<unknown>, __trace?: string): <R, E>(fa: Effect<R, E, A>) => Effect<R, E, A>;
export function filterOrDie<A>(p: Predicate<A>, dieWith: LazyArgument<unknown>, __trace?: string) {
  return <R, E>(fa: Effect<R, E, A>): Effect<R, E, A> => fa.filterOrElse(p, () => die(dieWith()))
}

Effect.succeed(1).filterOrElse((n) => true, () => Effect.succeed(""))

/**
 * @tsplus type pipeable/type-resolution/Test
 */
export type Test = number & {
  readonly Test: unique symbol
}

/**
 * @tsplus pipeable pipeable/type-resolution/Test isEnabled
 */
export function isEnabled(flag: number) {
  return (self: Test) => !!(self & flag)
}

declare const test: Test

const x = test.isEnabled(1)
