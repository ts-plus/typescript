/* eslint-disable */

declare function f <R, E, A>(effect: Effect<R, E, A>): void;

f(
  Do(($) => {
    const x = $(Deferred.make<never, void>());
    const y = x.await() > Effect.unit
    y
  })
);