export const ok = Effect.succeed(0).map((n) => `ok: ${n}`)
export type ok = Effect<unknown, never, string>

export namespace X {
  export const ok = Effect.succeed(0).map((n) => `ok: ${n}`)
  export type ok = typeof ok extends Effect<unknown, never, string> ? 1 : 0
}

// @ts-expect-error
export const A = Just

export type B = typeof T

export const C = T;
