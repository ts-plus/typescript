import { Check } from "./check";
import { Guard } from "./guard";
import { OptionalKeys, RequiredKeys, UnionToIntersection } from "./types";

/**
 * @tsplus type Show
 * @tsplus derive nominal
 */
export class Show<A> {
    constructor(readonly show: (a: A) => string) { }
}

//
// Top Priority
//

/**
 * @tsplus derive Show lazy
 */
export function deriveShowLazy<A>(
    ...args: [
        fn: (_: Show<A>) => Show<A>
    ]
): Show<A> {
    const show = args[0](new Show((type) => show.show(type)));
    return show;
}

//
// High Priority
//

/**
 * @tsplus derive Show<_> 10
 */
export function deriveShowLiteralUnion<A extends string | number>(
    ...[]: Check<Check.IsLiteral<A>> extends Check.True ? [] : never
): Show<A> {
    return new Show((a) => `${a}`)
}

/**
 * @tsplus derive Show[Maybe]<_> 10
 */
export function deriveShowMaybe<A extends Maybe<any>>(
    ...args: [A] extends [Maybe<infer _A>]
        ? [element: Show<_A>]
        : never
): Show<A> {
    return new Show((a) => a.isJust() ? `Maybe.Just(${args[0].show(a)})` : `Maybe.None`)
}

declare global {
    /**
     * @tsplus type MutableArray
     */
    export interface Array<T> {}
}

/**
 * @tsplus derive Show[MutableArray]<_> 10
 */
export function deriveShowArray<A extends Array<any>>(
    ...args: [A] extends [Array<infer _A>] ? [Array<_A>] extends [A] ? [
        element: Show<_A>
    ] : never : never
): Show<A> {
    return new Show((a) => `Array<{${a.map(args[0].show)}}>`)
}

//
// Mid Priority
//

/**
 * @tsplus derive Show<&> 20
 */
export function deriveShowIntersection<A extends unknown[]>(
    ...args: {
        [k in keyof A]: Show<A[k]>
    }
): Show<UnionToIntersection<A[number]>> {
    args
    throw new Error("Not Implemented")
}

/**
 * @tsplus derive Show<_> 20
 */
export function deriveShowStruct<A>(
    ...args: Check<Check.IsStruct<A>> extends Check.True ? [
        requiredFields: {
            [k in RequiredKeys<A>]: Show<A[k]>
        },
        optionalFields: {
            [k in OptionalKeys<A>]: Show<NonNullable<A[k]>>
        }
    ] : never
): Show<A> {
    args
    throw new Error("Not Implemented")
}

/**
 * @tsplus derive Show<[]> 20
 */
export function deriveShowTuple<A extends unknown[]>(
    ...args: {
        [k in keyof A]: Show<A[k]>
    }
): Show<A> {
    args
    throw new Error("Not Implemented")
}

/**
 * @tsplus derive Show<_> 20
 */
export function deriveShowUnionTagged<A extends { _tag: string }>(
    ...args: Check<Check.IsTagged<"_tag", A>> extends Check.True ? [
        members: {
            [k in A["_tag"]]: Show<Extract<A, { _tag: k }>>
        }
    ] : never
): Show<A> {
    args
    throw new Error("Not Implemented")
}

//
// Low priority
//

export interface GuardAndShow<A> {
    guard: Guard<A>
    show: Show<A>
}

/**
 * @tsplus derive Show<|> 30
 */
export function deriveShowUnion<A extends unknown[]>(
    ...args: {
        [k in keyof A]: GuardAndShow<A[k]>
    }
): Show<A[number]> {
    args
    throw new Error("Not Implemented")
}

/**
 * @tsplus implicit
 */
export const number = new Show((a: number) => `${a}`).via((x) => x)

/**
 * @tsplus implicit
 */
export const string = new Show((a: string) => a)

/**
 * @tsplus implicit
 */
export const date = new Show((a: Date) => a.toISOString())

/**
 * @tsplus implicit
 */
export const boolean = new Show((a: boolean) => a ? "true" : "false")
