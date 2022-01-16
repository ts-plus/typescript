import type {} from "./global";

const namedRef = FiberRef.unsafeMake("");

/**
 * @tsplus pipeable effect/core/io/Effect named
 */
export function forkDaemonNamed(name: string): <R, E, A>(self: Effect<R, E, A>) => Effect<R, E, A> {
  return namedRef.locally(name);
}
