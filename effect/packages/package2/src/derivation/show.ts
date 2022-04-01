import { Guard } from "./guard";
import { IsUnion, OptionalKeys, RequiredKeys, UnionToIntersection } from "./types";

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
export function deriveShowLiteral<A extends string | number>(
    ...args: IsUnion<A> extends false ? [
        value: A
    ] : never
): Show<A> {
    const literalString = typeof args[0] === "number" ? `${args[0]}` : args[0] as string
    return new Show(() => literalString)
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

//
// Mid Priority
//

/**
 * @tsplus derive Show<&> 20
 */
 export declare function deriveShowIntersection<A extends unknown[]>(
    ...args: {
        [k in keyof A]: Show<A[k]>
    }
): Show<UnionToIntersection<A[number]>>

/**
 * @tsplus derive Show<_> 20
 */
export declare function deriveShowStruct<A extends Record<string, any>>(
    ...args: keyof A extends string ? IsUnion<A> extends false ? [
        requiredFields: {
            [k in RequiredKeys<A>]: Show<A[k]>
        },
        optionalFields: {
            [k in OptionalKeys<A>]: Show<NonNullable<A[k]>>
        }
    ] : never : never
): Show<A>

/**
 * @tsplus derive Show<|> 10
 */
export declare function deriveShowLiteralUnion<A extends unknown[]>(
    ...args: A[number] extends string | number ? {
        [k in keyof A]: Show<A[k]>
    } : never
): Show<A[number]>

/**
 * @tsplus derive Show<[]> 20
 */
export declare function deriveShowTuple<A extends unknown[]>(
    ...args: {
        [k in keyof A]: Show<A[k]>
    }
): Show<A>

//
// Low priority
//

export interface GuardAndShow<A> {
    guard: Guard<A>
    show: Show<A>
}

/**
 * @tsplus derive Show<|> 10
 */
export declare function deriveShowUnion<A extends unknown[]>(
    ...args: {
        [k in keyof A]: GuardAndShow<A[k]>
    }
): Show<A[number]>

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