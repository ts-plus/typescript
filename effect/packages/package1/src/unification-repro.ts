import { Maybe } from "./prelude/definition/Maybe"

/**
 * @tsplus type unify/U
 * 
 * @tsplus companion unify/UOps
 */
export class U<R, E, A> {
  declare _R: () => R
  declare _E: () => E
  declare _A: () => A
}

/**
 * @tsplus unify unify/U
 */
export function unifyU<X extends U<any, any, any>>(_: X): U<
  [X] extends [{ _R: () => infer R }] ? R : never,
  [X] extends [{ _E: () => infer E }] ? E : never,
  [X] extends [{ _A: () => infer A }] ? A : never
> {
  return _
}

/**
 * @tsplus static unify/UOps failNow
 */
export declare function failNow<E>(e: E, __tsplusTrace?: string): U<never, E, never>

/**
 * @tsplus fluent unify/U catchAll
 */
export declare function catchAll_<R, E, A, R1, E1, A1>(
  ma: U<R, E, A>,
  f: (e: E) => U<R1, E1, A1>,
  __tsplusTrace?: string,
): U<R | R1, E1, A | A1>

/**
 * @tsplus fluent unify/U unrefineWith
 */
export declare function unrefineWith_<R, E, A, E1, E2>(
  fa: U<R, E, A>,
  pf: (u: unknown) => Maybe<E1>,
  f: (e: E) => E2,
  __tsplusTrace?: string,
): U<R, E1 | E2, A>

/**
 * @tsplus fluent unify/U catchJustDefect
 */
export function catchJustDefect_<R, E, A, R1, E1, A1>(
  ma: U<R, E, A>,
  f: (_: unknown) => Maybe<U<R1, E1, A1>>,
  __tsplusTrace?: string,
): U<R | R1, E | E1, A | A1> {
  return ma.unrefineWith(f, U.failNow).catchAll(a => a)
}