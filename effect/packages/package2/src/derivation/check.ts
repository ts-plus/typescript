export declare namespace TypeLevel {
    export type UnionToIntersection<T> =
        (T extends any ? (x: T) => any : never) extends
        (x: infer R) => any ? R : never

    export type RequiredKeys<T> = { [K in keyof T]-?:
        ({} extends { [P in K]: T[K] } ? never : K)
    }[keyof T]

    export type OptionalKeys<T> = { [K in keyof T]-?:
        ({} extends { [P in K]: T[K] } ? K : never)
    }[keyof T]

    export type UnionToTuple<Union> =
        UnionToIntersection<
            Union extends unknown
            ? (distributed: Union) => void
            : never
        > extends ((merged: infer Intersection) => void)
        ? readonly [...UnionToTuple<Exclude<Union, Intersection>>, Intersection]
        : [];
}

type EqualsWrapped<T> = T extends infer R & {}
    ? {
        [P in keyof R]: R[P]
    }
    : never

declare const No: unique symbol
declare const Ok: unique symbol

export declare namespace Check {
    type True = typeof Ok
    type False = typeof No

    type IsUnion<T> = [T] extends [TypeLevel.UnionToIntersection<T>] ? never : unknown
    type IsEqual<A, B> = (<T>() => T extends EqualsWrapped<A> ? 1 : 2) extends <
        T
        >() => T extends EqualsWrapped<B> ? 1 : 2
        ? unknown
        : never
    type Extends<A, B> = A extends B ? unknown : never
    type Not<A> = Check<A> extends Check.True ? Check.False : Check.True
}

export type Check<Condition> = [Condition] extends [never] ? Check.False : Check.True

export type X = Check<Check.IsUnion<"a" | "b"> & Check.IsEqual<0, 0>> extends Check.True ? "YAY" : "NAY"