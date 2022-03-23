import { Effect } from "./prelude";
import * as T from "./prelude/pipeable/pipeable"

export const ok = Effect.succeed(0) >> T.chain((n) => Effect.succeed(n))