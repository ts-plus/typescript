export const ok = Effect.succeed(0).map((n) => `ok: ${n}`)
export type ok = Effect<unknown, never, 0>