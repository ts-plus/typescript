import { Managed } from "@effect-ts/core";
import { Effect } from "./prelude";

export const effect = Effect.succeed(0) >>> Effect.$.chain((n) => Effect.succeed(0 + n)) >>> Effect.$.chain((n) => Effect.succeed(() => { console.log(n) }))

export const managed = effect >>> Managed.makeExit((s) => Effect.succeed(s));
