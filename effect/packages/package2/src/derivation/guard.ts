import { Maybe } from "@tsplus-test/package1/prelude";
import { IsUnion, OptionalKeys, RequiredKeys, UnionToIntersection } from "./types";

/**
 * @tsplus type Guard
 */
export class Guard<A> {
    constructor(readonly is: (u: unknown) => u is A) { }
}

//
// Top Priority
//

/**
 * @tsplus derivation Guard lazy
 */
export declare function deriveGuardLazy<A>(
    ...args: [
        fn: (_: Guard<A>) => Guard<A>
    ]
): Guard<A>

//
// High Priority
//

/**
 * @tsplus derivation Guard<_> 10
 */
export declare function deriveGuardLiteral<A extends string | number>(
    ...args: IsUnion<A> extends false ? [
        value: A
    ] : never
): Guard<A>

/**
 * @tsplus derivation Guard<_> 10
 */
export declare function deriveGuardMaybe<A extends Maybe<any>>(
    ...args: [A] extends [Maybe<infer _A>]
        ? [element: Guard<_A>]
        : never
): Guard<A>

/**
 * @tsplus derivation Guard<_> 10
 */
export declare function deriveGuardArray<A extends Array<any>>(
    ...args: [A] extends [Array<infer _A>] ? [Array<_A>] extends [A] ? [
        element: Guard<_A>
    ] : never : never
): Guard<A>

//
// Mid Priority
//

/**
 * @tsplus derivation Guard<&> 20
 */
export declare function deriveGuardIntersection<A extends unknown[]>(
    ...args: {
        [k in keyof A]: Guard<A[k]>
    }
): Guard<UnionToIntersection<A[number]>>

/**
 * @tsplus derivation Guard<_> 20
 */
export declare function deriveGuardStruct<A extends Record<string, any>>(
    ...args: keyof A extends string ? IsUnion<A> extends false ? [
        requiredFields: {
            [k in RequiredKeys<A>]: Guard<A[k]>
        },
        optionalFields: {
            [k in OptionalKeys<A>]: Guard<NonNullable<A[k]>>
        }
    ] : never : never
): Guard<A>

//
// Low priority
//

/**
 * @tsplus derivation Guard<|> 30
 */
export declare function deriveGuardUnion<A extends unknown[]>(
    ...args: {
        [k in keyof A]: Guard<A[k]>
    }
): Guard<A[number]>

//
// Implicits
//

/**
 * @tsplus implicit
 */
export declare const number: Guard<number>

/**
 * @tsplus implicit
 */
export declare const string: Guard<string>

/**
 * @tsplus implicit
 */
export declare const date: Guard<Date>

/**
 * @tsplus implicit
 */
export declare const boolean: Guard<boolean>