// @ts-expect-error
export const ok = Effect.succeed(0).map((n) => `ok: ${n}`)
export type ok = Effect<unknown, never, string>

export namespace X {
  export type ok = typeof ok extends Effect<unknown, never, string> ? 1 : 0
}

// @ts-expect-error
export const X = Just

export type Y = typeof T

