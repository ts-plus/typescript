import { Guard } from "./guard";
import { IsUnion, OptionalKeys, RequiredKeys, TypeEquals, UnionToIntersection } from "./types";

/**
 * @tsplus type Refinement
 */
export class Refinement<A, B extends A> {
    readonly _tag = "Refinement"
    constructor(readonly is: (a: A) => a is B) { }
}

//
// Top Priority
//

/**
 * @tsplus derive Refinement lazy
 */
export function deriveRefinementLazy<A, B extends A>(
    ...args: [
        fn: (_: Refinement<A, B>) => Refinement<A, B>
    ]
): Refinement<A, B> {
    args
    throw new Error("Not Implemented")
}

//
// High Priority
//

/**
 * @tsplus derive Refinement<_, _> 10
 */
export function deriveRefinementEmptyRecord<A, B extends A>(
    ...[]: TypeEquals<B, {}> extends true ? [] : never
): Refinement<A, B> {
    throw new Error("Not Implemented")
}

/**
 * @tsplus derive Refinement<_, _> 10
 */
export function deriveRefinementAlwaysTrue<A, B extends A>(
    ...[]: TypeEquals<A, B> extends true ? [] : never
): Refinement<A, B> {
    throw new Error("Not Implemented")
}

/**
 * @tsplus derive Refinement<_, _> 10
 */
export function deriveRefinementLiteralString<A, B extends A & string>(
    ...[value]: IsUnion<B> extends false ? string extends B ? never : [value: B] : never
): Refinement<A, B> {
    value
    throw new Error("Not Implemented")
}

/**
 * @tsplus derive Refinement<_, _> 10
 */
export function deriveRefinementLiteralNumber<A, B extends A & number>(
    ...[value]: IsUnion<B> extends false ? number extends B ? never : [value: B] : never
): Refinement<A, B> {
    value
    throw new Error("Not Implemented")
}

//
// Mid priority
//

/**
 * @tsplus derive Refinement<_, |> 20
 */
export function deriveRefinementUnion<A, B extends A[]>(
    ...members: {
        [k in keyof B]: B[k] extends A ? Refinement<A, B[k]> : never
    }
): Refinement<A, B[number]> {
    members
    throw new Error("Not Implemented")
}

/**
 * @tsplus derive Refinement<_, &> 20
 */
export function deriveRefinementIntersection<A, B extends unknown[]>(
    ...members: UnionToIntersection<B[number]> extends A ? {
        [k in keyof B]: B[k] extends A ? Refinement<A, B[k]> : never
    } : never
): UnionToIntersection<B[number]> extends A ? Refinement<A, UnionToIntersection<B[number]>> : never {
    members
    throw new Error("Not Implemented")
}

/**
 * @tsplus derive Refinement<_, _> 20
 */
export function deriveRefinementStruct<A, B extends Record<string, any> & A>(
    ...[requiredFields, optionalFields, objectRefinement]: keyof B extends string ? IsUnion<B> extends false ?
        A extends {} ? [
            requiredFields: {
                [k in RequiredKeys<B>]: k extends keyof A ? Refinement<A[k], B[k]> : Refinement<unknown, B[k]>
            },
            optionalFields: {
                [k in OptionalKeys<B>]: k extends keyof A ? Refinement<A[k], NonNullable<B[k]>> : Refinement<unknown, NonNullable<B[k]>>
            }
        ] : [
            requiredFields: {
                [k in RequiredKeys<B>]: k extends keyof A ? Refinement<A[k], B[k]> : Refinement<unknown, B[k]>
            },
            optionalFields: {
                [k in OptionalKeys<B>]: k extends keyof A ? Refinement<A[k], NonNullable<B[k]>> : Refinement<unknown, NonNullable<B[k]>>
            },
            objectRefinement: Refinement<unknown, {}>
        ]
        : never : never
): Refinement<A, B>  {
    requiredFields
    optionalFields
    objectRefinement
    throw new Error("Not Implemented")
}

//
// Low priority
//

/**
 * @tsplus derive Refinement<_, _> 30 no-recursion
 */
export function deriveRefinementFromUnknown<A, B extends A>(
    ...[guard]: [Guard<B>]
): Refinement<A, B> {
    guard
    throw new Error("Not Implemented")
}

//
// Usage
//

export const ok4: Refinement<unknown, { a: number }> = Derive()