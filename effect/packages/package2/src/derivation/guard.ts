import { Maybe } from "@tsplus-test/package1/prelude";
import { IsUnion, OptionalKeys, RequiredKeys, UnionToIntersection } from "./types";

/**
 * @tsplus type Guard
 * @tsplus derive nominal
 */
export class Guard<A> {
    readonly _tag = "Guard"
    constructor(readonly is: (u: unknown) => u is A) { }
}

//
// Top Priority
//

/**
 * @tsplus derive Guard lazy
 */
export function deriveGuardLazy<A>(
    ...args: [
        fn: (_: Guard<A>) => Guard<A>
    ]
): Guard<A> {
    args
    throw new Error("Not Implemented")
}

//
// High Priority
//

/**
 * @tsplus derive Guard<_> 10
 */
export function deriveGuardLiteralNumber<A extends number>(
    ...args: IsUnion<A> extends false ? number extends A ? never : [
        value: A
    ] : never
): Guard<A> {
    args
    throw new Error("Not Implemented")
}

/**
 * @tsplus derive Guard<_> 10
 */
export function deriveGuardLiteralString<A extends string>(
    ...args: IsUnion<A> extends false ? string extends A ? never : [
        value: A
    ] : never
): Guard<A> {
    args
    throw new Error("Not Implemented")
}

/**
 * @tsplus derive Guard<_> 10
 */
export function deriveGuardMaybe<A extends Maybe<any>>(
    ...args: [A] extends [Maybe<infer _A>]
        ? [element: Guard<_A>]
        : never
): Guard<A> {
    args
    throw new Error("Not Implemented")
}

/**
 * @tsplus derive Guard<_> 10
 */
export function deriveGuardArray<A extends Array<any>>(
    ...args: [A] extends [Array<infer _A>] ? [Array<_A>] extends [A] ? [
        element: Guard<_A>
    ] : never : never
): Guard<A> {
    args
    throw new Error("Not Implemented")
}

//
// Mid Priority
//

/**
 * @tsplus derive Guard<&> 20
 */
export function deriveGuardIntersection<A extends unknown[]>(
    ...args: {
        [k in keyof A]: Guard<A[k]>
    }
): Guard<UnionToIntersection<A[number]>> {
    args
    throw new Error("Not Implemented")
}

/**
 * @tsplus derive Guard<_> 20
 */
export function deriveGuardStruct<A extends Record<string, any>>(
    ...args: keyof A extends string ? IsUnion<A> extends false ? [
        requiredFields: {
            [k in RequiredKeys<A>]: Guard<A[k]>
        },
        optionalFields: {
            [k in OptionalKeys<A>]: Guard<NonNullable<A[k]>>
        }
    ] : never : never
): Guard<A> {
    args
    throw new Error("Not Implemented")
}

//
// Low priority
//

/**
 * @tsplus derive Guard<|> 30
 */
export function deriveGuardUnion<A extends unknown[]>(
    ...args: {
        [k in keyof A]: Guard<A[k]>
    }
): Guard<A[number]> {
    args
    throw new Error("Not Implemented")
}

//
// Implicits
//

/**
 * @tsplus implicit
 */
export const number: Guard<number> = 0 as any

/**
 * @tsplus implicit
 */
export const string: Guard<string> = 0 as any

/**
 * @tsplus implicit
 */
export const date: Guard<Date> = 0 as any

/**
 * @tsplus implicit
 */
export const boolean: Guard<boolean> = 0 as any

export const A: Guard<{
    a: string
}> = Derive()