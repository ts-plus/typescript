import * as T from "@effect-ts/core/Effect";

/**
 * @tsplus type ets/Effect
 */
export interface Effect<R, E, A> extends T.Effect<R, E, A> { }
/**
 * @tsplus type ets/EffectOps
 */
export interface EffectOps { }
export const Effect: EffectOps = {};

/**
 * @tsplus unify ets/Effect
 */
export function unifyEffect<X extends Effect<any, any, any>>(self: X): Effect<
    [X] extends [Effect<infer R, any, any>] ? R : never,
    [X] extends [Effect<any, infer E, any>] ? E : never,
    [X] extends [Effect<any, any, infer A>] ? A : never
> {
    return self
}