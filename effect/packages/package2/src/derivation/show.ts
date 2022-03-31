import { Guard } from "./guard";
import { IsUnion, OptionalKeys, RequiredKeys, UnionToIntersection } from "./types";

/**
 * @tsplus type Show
 */
export class Show<A> {
    constructor(readonly show: (a: A) => string) { }
}

//
// Low priority
//

/**
 * @tsplus rule Show 100 union
 */
export declare function deriveShowUnion<Types extends unknown[]>(
    ...args: {
        [k in keyof Types]: {
            guard: Guard<Types[k]>
            show: Show<Types[k]>
        }
    }
): Show<Types[number]>

//
// Mid Priority
//

/**
 * @tsplus rule Show 10 intersection
 */
export declare function deriveShowIntersection<Types extends unknown[]>(
    ...args: {
        [k in keyof Types]: Show<Types[k]>
    }
): Show<UnionToIntersection<Types[number]>>

/**
 * @tsplus rule Show 10 custom
 */
export declare function deriveShowStruct<Type extends Record<string, any>>(
    ...args: keyof Type extends string ? IsUnion<Type> extends false ? [
        requiredFields: {
            [k in RequiredKeys<Type>]: Show<Type[k]>
        },
        optionalFields: {
            [k in OptionalKeys<Type>]: Show<NonNullable<Type[k]>>
        }
    ] : never : never
): Show<Type>

//
// High Priority
//

/**
 * @tsplus rule Show 0 lazy
 */
export function deriveShowLazy<Type>(
    ...args: [
        fn: (_: Show<Type>) => Show<Type>
    ]
): Show<Type> {
    const show = args[0](new Show((type) => show.show(type)));
    return show;
}

/**
 * @tsplus rule Show 0 custom
 */
export function deriveShowLiteral<Type extends string | number>(
    ...args: IsUnion<Type> extends false ? [
        value: Type
    ] : never
): Show<Type> {
    const literalString = typeof args[0] === "number" ? `${args[0]}` : args[0] as string
    return new Show(() => literalString)
}

/**
 * @tsplus rule Show 0 custom
 */
export function deriveShowMaybe<Type extends Maybe<any>>(
    ...args: [Type] extends [Maybe<infer A>]
        ? [element: Show<A>]
        : never
): Show<Type> {
    return new Show((a) => a.isJust() ? `Maybe.Just(${args[0].show(a)})` : `Maybe.None`)
}

/**
 * @tsplus rule Show 0 custom
 */
export function deriveShowArray<Type extends Array<any>>(
    ...args: [Type] extends [Array<infer A>] ? [Array<A>] extends [Type] ? [
        element: Show<A>
    ] : never : never
): Show<Type> {
    return new Show((a) => `Array<{${a.map(args[0].show)}}>`)
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