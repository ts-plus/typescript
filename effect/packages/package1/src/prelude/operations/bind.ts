/* eslint-disable */
import * as T from "@effect-ts/core/Effect"
import { Flat } from "@effect-ts/core/Has"
import { Effect } from "../definition/Effect.js"

/**
 * Binds an effectful value in a `do` scope
 *
 * @tsplus fluent ets/Effect bind
 */
export function bind_<R2, E2, R, E, A, K extends Record<string, unknown>, N extends string>(self: Effect<R2, E2, K>, tag: Exclude<N, keyof K>, f: (_: K) => Effect<R, E, A>, __tsplusTrace?: string): Effect<R & R2, E | E2, Flat<K & {
    [k in N]: A
}>> {
    // @ts-expect-error
    return T.bind_(self, tag, f, __tsplusTrace)
}