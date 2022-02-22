import * as T from "@effect-ts/core/Effect";
import { Effect } from "../definition/Effect";
import { LazyArgument } from "../../utils/LazyArgument.js";

/**
 * Effectfully accesses the environment of the effect.
 *
 * @tsplus static ets/EffectOps access
 */
export function access<R0, A>(f: (_: R0) => A, __tsplusTrace?: string): Effect<R0, never, A> {
    return T.access(f, __tsplusTrace);
}
