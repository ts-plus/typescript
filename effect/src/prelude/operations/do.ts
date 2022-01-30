import * as T from "@effect-ts/core/Effect";
import { Effect } from "../definition/Effect.js";

/**
 * Creates a do context, to be used with bind/let
 *
 * @tsplus static ets/EffectOps do
 */
export const do_: Effect<unknown, never, {}> = T.do;
