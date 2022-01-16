import * as T from "@effect-ts/core/Effect";
import { Effect } from "../definition/Effect.js";

/**
 * Returns the effect resulting from mapping the success of this effect to unit.
 *
 * @tsplus static ets/EffectOps unit
 */
export const unit: Effect<unknown, never, void> = T.unit;
