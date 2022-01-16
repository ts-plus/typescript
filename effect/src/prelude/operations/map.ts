import { Effect } from "../definition/Effect.js";

/**
 * Returns an effect whose success is mapped by the specified `f` function.
 *
 * @ets fluent ets/Effect map
 */
export function map_<R, E, A, B>(self: Effect<R, E, A>, f: (a: A) => B, __etsTrace?: string): Effect<R, E, B> {
    return self.flatMap((a) => Effect.succeed(f(a)));
}
