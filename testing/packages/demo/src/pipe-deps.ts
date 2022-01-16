export function id<A>(a: A): A {
    return a
}

/**
 * @tsplus operator Either /
 * @tsplus macro pipe
 */
export function pipe<A, B>(self: A, f: (a: A) => B): B {
    return f(self)
}

export function map<A, B>(f: (a: A) => B) {
    return <E>(self: Either<E, A>) => self.map(f)
}