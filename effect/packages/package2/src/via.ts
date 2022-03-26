export const f2 = (0).via(n => n + 1, n => n + 2);
export const f0 = (1).days

export const ok = Effect.succeed(0).map((n) => `ok: ${n}`)
export type ok = Effect<unknown, never, 0>