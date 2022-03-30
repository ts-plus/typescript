import { Maybe } from "@tsplus-test/package1/prelude"

export type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true

export type UnionToIntersection<T> =
    (T extends any ? (x: T) => any : never) extends
    (x: infer R) => any ? R : never

export type RequiredKeys<T> = { [K in keyof T]-?:
    ({} extends { [P in K]: T[K] } ? never : K)
}[keyof T]

export type OptionalKeys<T> = { [K in keyof T]-?:
    ({} extends { [P in K]: T[K] } ? K : never)
}[keyof T]

export type StringIndexedRecord = Record<string, any>

/**
 * @tsplus macro Derive
 */
export declare function Derive<A>(): A

/**
 * @tsplus type Show
 */
export class Show<A> {
    constructor(readonly show: (a: A) => string) { }
}

/**
 * @tsplus rule Show intersection
 */
export declare function showIntersection<Types extends unknown[]>(
    ...args: {
        [k in keyof Types]: Show<Types[k]>
    }
): Show<UnionToIntersection<Types[number]>>

/**
 * @tsplus rule Show lazy
 */
export declare function showLazy<Type>(
    ...args: [
        fn: () => Show<Type>
    ]
): Show<Type>

/**
 * @tsplus rule Show union
 */
export declare function showUnion<Types extends unknown[]>(
    ...args: {
        [k in keyof Types]: Show<Types[k]>
    }
): Show<Types[number]>

/**
 * @tsplus rule Show custom
 */
export declare function showStruct<Type extends Record<string, any>>(
    ...args: keyof Type extends string ? IsUnion<Type> extends false ? [
        requiredFields: {
            [k in RequiredKeys<Type>]: Show<Type[k]>
        },
        optionalFields: {
            [k in OptionalKeys<Type>]: Show<NonNullable<Type[k]>>
        }
    ] : never : never
): Show<Type>

/**
 * @tsplus rule Show custom
 */
export declare function showMaybe<Type extends Maybe<any>>(
    ...args: [Type] extends [Maybe<infer A>]
        ? [element: Show<A>]
        : never
): Show<Type>

/**
 * @tsplus implicit
 */
export declare const showNumber: Show<number>


/**
 * @tsplus implicit
 */
export const string = new Show((a: string) => a)


/**
 * @tsplus implicit
 */
export declare const showDate: Show<Date>

//
// Usage
//

export interface Person {
    name: string
    surname: string
    age: Maybe<number>
    birthDate?: Date
}

/**
 * @tsplus implicit
 */
export const showPerson: Show<Person> = Derive()