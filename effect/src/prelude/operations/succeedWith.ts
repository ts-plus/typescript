import * as T from "@effect-ts/core/Effect";
import { Effect } from "../definition/Effect";
import { LazyArgument } from "../../utils/LazyArgument.js";

/**
 * Imports a synchronous side-effect into a pure value
 *
 * @ets static ets/EffectOps succeed
 */
export function succeedWith<A>(effect: LazyArgument<A>, __etsTrace?: string): Effect<unknown, never, A> {
    return T.succeedWith(effect, __etsTrace);
}

/**
 * Imports a synchronous side-effect into a pure value
 *
 * @ets static ets/EffectOps __call
 */
export function effectApply<A>(effect: LazyArgument<A>, __etsTrace?: string): Effect<unknown, never, A> {
    return T.succeedWith(effect, __etsTrace);
}
