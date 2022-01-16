/**
 * @tsplus type IO
 * @tsplus companion IOOps
 */
export class IO<A> {
    constructor(readonly io: () => A) {}
}

/**
 * @tsplus static IOOps __call
 */
export function applyIO<A>(f: () => A): IO<A> {
    return new IO(f);
}

/**
 * @tsplus fluent IO map
 */
export function map<A, B>(self: IO<A>, f: (a: A) => B) {
    return new IO(() => f(self.io()))
}

new IO(() => 0).map((n) => n + 1)

export class ExtendedIO<A> extends IO<A> {
    constructor(io: () => A) {
        super(io)
    }
}