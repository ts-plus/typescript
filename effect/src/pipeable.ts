/**
 * @tsplus type Id
 */
export interface Id<A> {
    readonly a: A
}

function id<A>(a: A): Id<A> {
    return { a }
}

/**
 * @tsplus operator Id >
 */
export declare function pipeId<A, B>(self: Id<A>, f: (a: Id<A>) => B) : B 

export const x = id(0) > ((n) => n)