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
 * @tsplus rule Guard 0 lazy
 */
export declare function deriveGuardLazy<Type>(
    ...args: [
        fn: (_: Guard<Type>) => Guard<Type>
    ]
): Guard<Type>

//
// High Priority
//

/**
 * @tsplus rule Guard 10 custom
 */
export declare function deriveGuardLiteral<Type extends string | number>(
    ...args: IsUnion<Type> extends false ? [
        value: Type
    ] : never
): Guard<Type>

/**
 * @tsplus rule Guard 10 custom
 */
export declare function deriveGuardMaybe<Type extends Maybe<any>>(
    ...args: [Type] extends [Maybe<infer A>]
        ? [element: Guard<A>]
        : never
): Guard<Type>

/**
 * @tsplus rule Guard 10 custom
 */
export declare function deriveGuardArray<Type extends Array<any>>(
    ...args: [Type] extends [Array<infer A>] ? [Array<A>] extends [Type] ? [
        element: Guard<A>
    ] : never : never
): Guard<Type>

//
// Mid Priority
//

/**
 * @tsplus rule Guard 20 intersection
 */
export declare function deriveGuardIntersection<Types extends unknown[]>(
    ...args: {
        [k in keyof Types]: Guard<Types[k]>
    }
): Guard<UnionToIntersection<Types[number]>>

/**
 * @tsplus rule Guard 20 custom
 */
export declare function deriveGuardStruct<Type extends Record<string, any>>(
    ...args: keyof Type extends string ? IsUnion<Type> extends false ? [
        requiredFields: {
            [k in RequiredKeys<Type>]: Guard<Type[k]>
        },
        optionalFields: {
            [k in OptionalKeys<Type>]: Guard<NonNullable<Type[k]>>
        }
    ] : never : never
): Guard<Type>

//
// Low priority
//

/**
 * @tsplus rule Guard 30 union
 */
export declare function deriveGuardUnion<Types extends unknown[]>(
    ...args: {
        [k in keyof Types]: Guard<Types[k]>
    }
): Guard<Types[number]>

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