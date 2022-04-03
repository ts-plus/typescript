import { Check } from "./check";
import { Guard } from "./guard";
import { IsUnion, OptionalKeys, RequiredKeys, UnionToIntersection, UnionToTuple } from "./types";

/**
 * @tsplus type Show
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
export function deriveShowLiteralNumber<A extends number>(
    ...args: Check<
        Check.Not<Check.IsUnion<A>> &
        Check.Not<Check.Extends<number, A>>
    > extends Check.True ? [
            value: A
        ] : never
): Show<A> {
    return new Show(() => `${args[0]}`)
}

/**
 * @tsplus derive Show<_> 10
 */
export function deriveShowLiteralString<A extends string>(
    ...args: Check<
        Check.Not<Check.IsUnion<A>> &
        Check.Not<Check.Extends<string, A>>
    > extends Check.True ? [
            value: A
        ] : never
): Show<A> {
    return new Show(() => args[0])
}

/**
 * @tsplus derive Show<_> 10
 */
export function deriveShowMaybe<A extends Maybe<any>>(
    ...args: [A] extends [Maybe<infer _A>]
        ? [element: Show<_A>]
        : never
): Show<A> {
    return new Show((a) => a.isJust() ? `Maybe.Just(${args[0].show(a)})` : `Maybe.None`)
}

/**
 * @tsplus derive Show<_> 10
 */
export function deriveShowArray<A extends Array<any>>(
    ...args: [A] extends [Array<infer _A>] ? [Array<_A>] extends [A] ? [
        element: Show<_A>
    ] : never : never
): Show<A> {
    return new Show((a) => `Array<{${a.map(args[0].show)}}>`)
}

/**
 * @tsplus derive Show<|> 10
 */
export function deriveShowLiteralUnion<A extends unknown[]>(
    ...args: Check<
        Check.Extends<A[number], string | number> &
        Check.Not<Check.IsEqual<A[number], string | number>> &
        Check.Not<Check.IsEqual<A[number], string>> &
        Check.Not<Check.IsEqual<A[number], number>>
    > extends Check.True ? {
            [k in keyof A]: Show<A[k]>
        } : never
): Show<A[number]> {
    args
    throw new Error("Not Implemented")
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
export function deriveShowStruct<A extends Record<string, any>>(
    ...args: keyof A extends string ? IsUnion<A> extends false ? [
        requiredFields: {
            [k in RequiredKeys<A>]: Show<A[k]>
        },
        optionalFields: {
            [k in OptionalKeys<A>]: Show<NonNullable<A[k]>>
        }
    ] : never : never
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
 * @tsplus derive Show<|> 20
 */
export function deriveShowUnionTagged<A extends { _tag: string }[]>(
    ...args: UnionToTuple<A[number]["_tag"]>["length"] extends A["length"] ? [
        members: {
            [k in A[number]["_tag"]]: Show<Extract<A[number], { _tag: k }>>
        }
    ] : never
): Show<A[number]> {
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
export const number = new Show((a: number) => `${a}`)

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