import { Effect, T } from "../definition/Effect";
import { bind_ } from "../operations/bind";
import { chain_ } from "../operations/flatMap";

/**
 * @tsplus static ets/EffectAspects chain
 */
export const chain = Pipeable(chain_);
/**
 * @tsplus static ets/EffectAspects bind
 */
export const bind = Pipeable(bind_);

export const ok = pipe(
  T.succeed(0),
  T.chain(n => T.succeed(n + 1))
);

/**
 * @tsplus pipeable ets/Effect chainPipeable
 */
export const chainPipeable =
  <A, R1, E1, B>(f: (a: A) => Effect<R1, E1, B>) =>
  <R, E>(effect: Effect<R, E, A>): Effect<R & R1, E | E1, B> =>
    effect.flatMap(f);

const x = Effect(1).chainPipeable((n) => Effect(2))
