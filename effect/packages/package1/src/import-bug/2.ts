import { Effect } from "../prelude";
import { anEffect } from "./1";

export const y = anEffect.flatMap((x) => Effect.succeed(x + 1))