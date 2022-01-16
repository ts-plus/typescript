import { Managed } from "@effect-ts/core";
import * as _ from "@effect-ts/core/Effect";
import { suspend } from "@effect-ts/core/Effect";

/**
 * @tsplus type ets/Effect
 */
export interface Effect<R, E, A> extends _.Effect<R, E, A> {
}
/**
 * @tsplus type ets/EffectOps
 */
export interface EffectOps { ["$"]: EffectAspects }
export const Effect: EffectOps = { "$": {} };

/**
 * @tsplus type ets/EffectAspects
 */
export interface EffectAspects { }

/**
 * @tsplus static ets/EffectOps pipe
 */
export const T: EffectAspects = {}

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

/**
 * Pipes an Effect returning function
 * 
 * @tsplus fluent ets/Effect via
 * @tsplus operator ets/Effect >>>
 */
export function via<R, E, A, R1, E1, B>(self: Effect<R, E, A>, f: (a: Effect<R, E, A>) => Effect<R1, E1, B>): Effect<R1, E1, B> {
    return suspend(() => f(self))
}

/**
 * Pipes a Managed returning function
 * 
 * @tsplus fluent ets/Effect via
 * @tsplus operator ets/Effect >>>
 */
export function viaManaged<R, E, A, R1, E1, B>(self: Effect<R, E, A>, f: (a: Effect<R, E, A>) => Managed.Managed<R1, E1, B>): Managed.Managed<R1, E1, B> {
    return Managed.suspend(() => f(self))
}
