import * as T from "@effect-ts/core/Effect";
import { Effect } from "../definition/Effect.js";

/**
 * Returns an effect that models the execution of this effect, followed by
 * the passing of its value to the specified continuation function `f`,
 * followed by the effect that it returns.
 *
 * @tsplus fluent ets/Effect flatMap
 */
export function chain_<R, E, A, R1, E1, A1>(
  self: Effect<R, E, A>,
  f: (a: A) => Effect<R1, E1, A1>,
  __tsplusTrace?: string
): Effect<R & R1, E | E1, A1> {
  return T.chain_(self, f, __tsplusTrace);
}