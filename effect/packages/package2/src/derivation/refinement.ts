import { Derive, IsUnion } from "./types";

/**
 * @tsplus type Refinement
 */
export class Refinement<A, B extends A> {
    constructor(readonly is: (a: A) => a is B) {}
}

//
// Top Priority
//

/**
 * @tsplus derive Refinement lazy
 */
 export declare function deriveGuardLazy<A, B extends A>(
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
export declare function deriveRefinementLiteral<A, B extends A>(
    ...args: IsUnion<B> extends false ? B extends string | number ? [
        value: B
    ] : never : never
): Refinement<A, B>

export const ok: Refinement<unknown, "ok"> = Derive()