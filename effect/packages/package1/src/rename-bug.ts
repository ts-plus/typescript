import { Effect } from "./prelude";

/**
 * @tsplus type rename-bug/Ops
 */
export interface Ops {}

const Ops: Ops = {}

/**
 * @tsplus static rename-bug/Ops succeed
 */
export const succeed = Effect.succeed

const succeed2 = Ops.succeed

Effect.succeed(1).flatMap((x) => Effect(1))