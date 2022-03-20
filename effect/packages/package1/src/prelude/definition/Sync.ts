import * as _ from "@effect-ts/core/Sync";
import { Effect, unifyEffect } from "./Effect";

/**
 * @tsplus type ets/Sync
 */
export interface Sync<R, E, A> extends _.Sync<R, E, A>, Effect<R, E, A> { }
/**
 * @tsplus type ets/SyncOps
 */
export interface SyncOps { }
export const Sync: SyncOps = {};

/**
 * @tsplus type ets/SyncAspects
 */
export interface SyncAspects { }

/**
 * @tsplus static ets/SyncOps pipe
 */
export const T: SyncAspects = {}

/**
 * @tsplus unify ets/Sync
 */
export function unifySync<X extends Sync<any, any, any>>(self: X): Sync<
    [X] extends [Sync<infer R, any, any>] ? R : never,
    [X] extends [Sync<any, infer E, any>] ? E : never,
    [X] extends [Sync<any, any, infer A>] ? A : never
> {
    return self
}

// /**
//  * Returns an effect that models the execution of this effect, followed by
//  * the passing of its value to the specified continuation function `f`,
//  * followed by the effect that it returns.
//  *
//  * @tsplus fluent ets/Sync flatMap
//  */
// export declare function chain_<R, E, A, R1, E1, A1>(
//     self: Sync<R, E, A>,
//     f: (a: A) => Sync<R1, E1, A1>,
//     __tsplusTrace?: string
// ): Sync<R & R1, E | E1, A1>
// 

export const unifiedEffect = (n: number) => {
    if (n > 0) {
        return 0 as unknown as Effect<{ a: number }, "a", 0>
    }
    return 0 as unknown as Sync<{ b: number }, "b", 1>
}

export const unifiedSync = (n: number) => {
    if (n > 0) {
        return 0 as unknown as Sync<{ a: number }, "a", 0>
    }
    return 0 as unknown as Sync<{ b: number }, "b", 1>
}

// c.flatMap(() => Effect(0))