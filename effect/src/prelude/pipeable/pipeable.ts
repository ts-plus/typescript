import { T } from "../definition/Effect";
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
    T.chain((n) => T.succeed(n + 1))
)
