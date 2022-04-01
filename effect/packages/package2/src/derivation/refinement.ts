import { Guard } from "./guard";
import { Derive, IsUnion, OptionalKeys, RequiredKeys, TypeEquals, UnionToIntersection } from "./types";

/**
 * @tsplus type Refinement
 */
export class Refinement<A, B extends A> {
    constructor(readonly is: (a: A) => a is B) { }
}

//
// Top Priority
//

/**
 * @tsplus derive Refinement lazy
 */
export declare function deriveRefinementLazy<A, B extends A>(
    ...args: [
        fn: (_: Refinement<A, B>) => Refinement<A, B>
    ]
): Refinement<A, B>

//
// High Priority
//

/**
 * @tsplus derive Refinement<_, _> 10
 */
export declare function deriveRefinementEmptyRecord<A, B extends A>(
    ...args: TypeEquals<B, {}> extends true ? [] : never
): Refinement<A, B>

/**
 * @tsplus derive Refinement<_, _> 10
 */
export declare function deriveRefinementAlwaysTrue<A, B extends A>(
    ...args: TypeEquals<A, B> extends true ? [] : never
): Refinement<A, B>

/**
 * @tsplus derive Refinement<_, _> 10
 */
export declare function deriveRefinementLiteralString<A, B extends A & string>(
    ...args: IsUnion<B> extends false ? string extends B ? never : [
        value: B
    ] : never
): Refinement<A, B>

/**
 * @tsplus derive Refinement<_, _> 10
 */
export declare function deriveRefinementLiteralNumber<A, B extends A & number>(
    ...args: IsUnion<B> extends false ? number extends B ? never : [
        value: B
    ] : never
): Refinement<A, B>

//
// Mid priority
//

/**
 * @tsplus derive Refinement<_, |> 20
 */
export declare function deriveRefinementUnion<A, B extends A[]>(
    ...args: {
        [k in keyof B]: B[k] extends A ? Refinement<A, B[k]> : never
    }
): Refinement<A, B[number]>

/**
 * @tsplus derive Refinement<_, &> 20
 */
export declare function deriveRefinementIntersection<A, B extends unknown[]>(
    ...args: UnionToIntersection<B[number]> extends A ? {
        [k in keyof B]: B[k] extends A ? Refinement<A, B[k]> : never
    } : never
): UnionToIntersection<B[number]> extends A ? Refinement<A, UnionToIntersection<B[number]>> : never

/**
 * @tsplus derive Refinement<_, _> 20
 */
export function deriveRefinementStruct<A, B extends Record<string, any> & A>(
    ...[req, opt, obj]: keyof B extends string ? IsUnion<B> extends false ?
        A extends {} ? [
            requiredFields: {
                [k in RequiredKeys<B>]: k extends keyof A ? Refinement<A[k], B[k]> : Guard<B[k]>
            },
            optionalFields: {
                [k in OptionalKeys<B>]: k extends keyof A ? Refinement<A[k], NonNullable<B[k]>> : Guard<NonNullable<B[k]>>
            }
        ] : [
            requiredFields: {
                [k in RequiredKeys<B>]: k extends keyof A ? Refinement<A[k], B[k]> : Guard<B[k]>
            },
            optionalFields: {
                [k in OptionalKeys<B>]: k extends keyof A ? Refinement<A[k], NonNullable<B[k]>> : Guard<NonNullable<B[k]>>
            },
            objectRefinement: Refinement<unknown, {}>
        ]
        : never : never
): Refinement<A, B> {
    req;
    opt;
    obj;
    throw new Error("NI");
}

//
// Low priority
//

/**
 * @tsplus derive Refinement<_, _> 30
 */
export declare function deriveRefinementFromUnknown<A, B extends A>(
    ...args: unknown extends A ? never : [guard: Guard<B>]
): Refinement<A, B>

//
// Usage
//

export const ok4: Refinement<unknown, { a: number, b?: string }> = Derive()