import * as T from "@effect-ts/core/Effect";
import { Effect } from "../definition/Effect";

/**
 * Runs an effect as a promise
 *
 * @ets fluent ets/Effect unsafeRunPromise
 */
export function unsafeRunPromise<E, A>(self: Effect<T.DefaultEnv, E, A>, __etsTrace?: string) {
    return T.runPromise(self)
}
