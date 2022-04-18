/**
 * @tsplus operator ets/Effect /
 * @tsplus fluent ets/Effect apply
 * @tsplus fluent ets/Effect __call
 * @tsplus macro pipe
 */
export function pipe<A, B>(a: A, ab: (a: A) => B) {
    return ab(a)
}

export function make<T extends Effect<any, any, any>>(eff: T) {
    return {
        eff,
    }
}

const worksFine = Effect.succeed(1) / Effect.$.map((x) => x * 2)
export const worksFineA = identity(worksFine)

export const breaksA = make(Effect.succeed(1) / Effect.$.map((x) => x * 2))