/**
 * @tsplus type Nothing
 */
export interface Nothing {
    readonly _tag: "Nothing"
}

export interface Just<A> {
    readonly _tag: "Just"
    readonly value: A
}

/**
 * @tsplus type Maybe
 */
export type Maybe<A> = Nothing | Just<A>

/**
 * @tsplus type MaybeOps
 */
export interface MaybeOps { }

export const Maybe: MaybeOps = {}

/**
 * @tsplus unify Maybe
 */
export function unifyMaybe<X extends Maybe<any>>(self: X): Maybe<
    [X] extends [Maybe<infer A>] ? A : never
> {
    return self
}

/**
 * @tsplus static MaybeOps nothing
 */
export function nothing(): Maybe<never> {
    return { _tag: "Nothing" }
}

/**
 * @tsplus static MaybeOps just
 */
export function just<A>(value: A): Maybe<A> {
    return { _tag: "Just", value }
}

/**
 * @tsplus fluent Maybe match
 */
export function match_<A, B, C>(self: Maybe<A>, onNothing: () => B, onJust: (a: A) => C): B | C {
    return self._tag === "Nothing" ? onNothing() : onJust(self.value);
}

/**
 * @tsplus operator Maybe +
 * @tsplus fluent Maybe zip
 */
export function zip_<A, B>(self: Maybe<A>, that: Maybe<B>): Maybe<readonly [A, B]> {
    throw new Error("unimplemented")
}

/**
 * @tsplus fluent Maybe isJust
 */
export function isJust<A>(self: Maybe<A>): self is Just<A> {
    return self._tag === "Just";
}

/**
 * @tsplus fluent Maybe isNothing
 */
export function isNothing<A>(self: Maybe<A>): self is Nothing {
    return self._tag === "Nothing";
}

/**
 * @tsplus fluent Maybe assertJust
 */
export function assertJust<A>(self: Maybe<A>): asserts self is Just<A> {
    if(self._tag !== "Just") {
        throw new Error("Not Just");
    }
}

/**
 * @tsplus getter Maybe value
 */
export function value<A>(self: Maybe<A>) {
    return self._tag === "Just" ? self.value : void 0
}

/**
 * @tsplus fluent Nothing assertJust
 */
export function assertJustNothing(self: Nothing): never {
    throw new Error("Not Just");
}
    

// /**
//  * @tsplus getter Maybe value
//  */
// export function get<A>(self: Maybe<A>): A | undefined {
//     return self._tag === "Just" ? self.value : undefined
// }

export const result = Maybe.just(0).match(() => 0, () => 1)
export const op = Maybe.just(0) + Maybe.just(1)
