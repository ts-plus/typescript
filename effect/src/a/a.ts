/**
 * @tsplus type Id
 */
export interface Id<A> {
    readonly a: A
}

/**
 * @tsplus type IdOps
 */
export interface IdOps {}
export const Id: IdOps = {}

/**
 * @tsplus static IdOps id
 */
export function id<A>(a: A): Id<A> {
    return {a}
}