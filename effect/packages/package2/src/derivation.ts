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


//
// Low priority
//

/**
 * @tsplus rule Show 100 union
 */
export declare function showUnion<Types extends unknown[]>(
    ...args: {
        [k in keyof Types]: Show<Types[k]>
    }
): Show<Types[number]>


//
// Mid Priority
//

/**
 * @tsplus rule Show 10 intersection
 */
export declare function showIntersection<Types extends unknown[]>(
    ...args: {
        [k in keyof Types]: Show<Types[k]>
    }
): Show<UnionToIntersection<Types[number]>>

/**
 * @tsplus rule Show 10 custom
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

//
// High Priority
//

/**
 * @tsplus rule Show 0 lazy
 */
export function showLazy<Type>(
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
export function showLiteral<Type extends string | number>(
    ...args: IsUnion<Type> extends false ? [
        value: Type
    ] : never
): Show<Type> {
    const literalString = typeof args[0] === "number" ? `${args[0]}` : args[0] as string
    return new Show<Type>(() => literalString)
}

/**
 * @tsplus rule Show 0 custom
 */
export function showMaybe<Type extends Maybe<any>>(
    ...args: [Type] extends [Maybe<infer A>]
        ? [element: Show<A>]
        : never
): Show<Type> {
    return new Show((a) => a.isJust() ? `Maybe.Just(${args[0].show(a)})` : `Maybe.None`)
}

/**
 * @tsplus rule Show 0 custom
 */
export function showArray<Type extends Array<any>>(
    ...args: [Type] extends [Array<infer A>] ? [Array<A>] extends [Type] ? [
        element: Show<A>
    ] : never : never
): Show<Type> {
    return new Show((a) => `Array<{${a.map(args[0].show)}}>`)
}

//
// Implicits
//

/**
 * @tsplus implicit
 */
export const showNumber = new Show((a: number) => `${a}`)

/**
 * @tsplus implicit
 */
export const string = new Show((a: string) => a)

/**
 * @tsplus implicit
 */
export const showDate = new Show((a: Date) => a.toISOString())

//
// Usage
//

export interface Person {
    tag: "Person"
    gender: "M" | "F" | "NB" | "NA"
    name: string
    surname: string
    age: Maybe<number>
    birthDate?: Date
    bestFriend: Maybe<Person>
    friends: Person[]
}

export interface User {
    id: string
    owner: Person
}

/**
 * @tsplus implicit
 */
export const showPerson = Derive<Show<User>>()
