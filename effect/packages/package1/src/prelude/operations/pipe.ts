import { Effect } from "../definition/Effect"
import { flatMap } from "../pipeable/pipeable"

export const res = Effect.succeed(0)(
    flatMap((n) => Effect.succeed(n + 1)),
    flatMap((n) => Effect.succeed(n + 1)),
    flatMap((n) => Effect.succeed(`${n + 1}`))
)