/* eslint-disable */
import * as T from "@effect-ts/core/Effect"
import { Effect } from "../definition/Effect.js"
import { LazyArgument } from "../../utils/LazyArgument.js"

/**
 * Sequentially zips this effect with the specified effect
 *
 * @tsplus operator ets/Effect |
 * @tsplus fluent ets/Effect orElse
 */
export const orElse_ = <R, E, A, R2, E2, A2>(self: Effect<R, E, A>, that: LazyArgument<Effect<R2, E2, A2>>, __tsplusTrace?: string) => {
    return T.orElse_(self, that, __tsplusTrace)
}