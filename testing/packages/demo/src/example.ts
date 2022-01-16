import { Effect } from "@effect/core/io/Effect";

export const y = (Effect(0) as Effect<unknown, unknown, number>).map((n) => n + 1);
export const z = (Effect(0) as Effect.UIO<number>).map((n) => n + 1);

Effect.succeed(0).map((n) => n + 1);
Effect.succeed(0).map((n) => n + 1).cause().uncause();

const scoped = Effect.scoped(
    Effect.acquireRelease(Effect.succeed(0), () => Effect.unit)
);