import { Derive, IsUnion } from "./types";

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
export declare function deriveRefinementLiteral<A, B extends A & (string | number)>(
    ...args: IsUnion<B> extends false ? [
        value: B
    ] : never
): Refinement<A, B>

/**
 * @tsplus derive Refinement<_, |> 20
 */
export declare function deriveRefinementUnion<A, B extends A[]>(
    ...args: {
        [k in keyof B]: B[k] extends A ? Refinement<A, B[k]> : never
    }
): Refinement<A, B[number]>

//
// Usage
//

export const ok: Refinement<unknown, "ok" | "yes"> = Derive()