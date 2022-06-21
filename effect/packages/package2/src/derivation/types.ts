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

type EqualsWrapped<T> = T extends infer R & {}
    ? {
        [P in keyof R]: R[P]
    }
    : never

export type TypeEquals<A, B> = (<T>() => T extends EqualsWrapped<A> ? 1 : 2) extends <
    T
    >() => T extends EqualsWrapped<B> ? 1 : 2
    ? true
    : false

export type IsTypeEqualToAnyOf<X, Y extends unknown[]> = Y["length"] extends 0 ? false : ({
    [k in keyof Y]: TypeEquals<X, Y[k]>
}[number] extends false ? false : true)

export type UnionToTuple<Union> =
    UnionToIntersection<
        Union extends unknown
        ? (distributed: Union) => void
        : never
    > extends ((merged: infer Intersection) => void)
    ? readonly [...UnionToTuple<Exclude<Union, Intersection>>, Intersection]
    : [];

export type IsNever<T> = [T] extends [never] ? true : false;

declare global {
    /** @tsplus derive nominal */
    interface Date {}
    /** @tsplus derive nominal */
    interface Array<T> {}
}