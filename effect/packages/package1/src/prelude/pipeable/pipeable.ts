import { pipe } from "../../primitives";
import { Effect, T } from "../definition/Effect";
import { bind_ } from "../operations/bind";
import { chain_ } from "../operations/flatMap.js";

/**
 * @tsplus static ets/EffectAspects chain
 */
export const chain = Pipeable(chain_);

/**
 * @tsplus pipeable ets/Effect flatMap
 */
export const flatMap = <A, R1, E1, B>(f: (a: A) => Effect<R1, E1, B>) => <R, E>(
  effect: Effect<R, E, A>
): Effect<R & R1, E | E1, B> => effect.flatMap(f);

/**
 * @tsplus static ets/EffectAspects bind
 */
export const bind = Pipeable(bind_);

export const ok = pipe(
  T.succeed(0),
  T.chain(n => Effect(n + 1)),
  chain(n => Effect(n + 1)),
);

const ok2 = T.chain((n: number) => Effect(n + 1))(T.succeed(0));

/**
 * @tsplus pipeable ets/Effect chainPipeable
 */
export const chainPipeable = <A, R1, E1, B>(f: (a: A) => Effect<R1, E1, B>) => <
  R,
  E
>(
  effect: Effect<R, E, A>
): Effect<R & R1, E | E1, B> => effect.flatMap(f);

const x = Effect(1).chainPipeable(n => Effect(2));

ok.unsafeRunPromise().then(x => console.log(x));


/**
 * @tsplus pipeable ets/Effect zipWithAll
 */
export declare const zipWithAll: <As extends unknown[]>(...args: As) => <
  R,
  E,
  A
>(
  effect: Effect<R, E, A>
) => Effect<R, E, [A, ...As]> 