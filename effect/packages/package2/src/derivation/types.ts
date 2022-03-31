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