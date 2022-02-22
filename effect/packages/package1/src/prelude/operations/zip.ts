/* eslint-disable */
import * as T from "@effect-ts/core/Effect"
import * as Tp from "@effect-ts/core/Collections/Immutable/Tuple"
import { Effect } from "../definition/Effect.js"

/**
 * Sequentially zips this effect with the specified effect
 *
 * @tsplus operator ets/Effect +
 * @tsplus fluent ets/Effect zip
 */
export function zip_<R, E, A, R2, E2, A2>(self: Effect<R, E, A>, that: Effect<R2, E2, A2>, __tsplusTrace?: string): Effect<R & R2, E | E2, Tp.Tuple<[A, A2]>> {
    return T.zip_(self, that, __tsplusTrace)
}