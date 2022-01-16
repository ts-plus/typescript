/**
 * @tsplus type IO
 */
export class IO<A> {
    constructor(readonly io: () => A) {}
}

/**
 * @tsplus fluent IO map
 */
export function map<A, B>(self: IO<A>, f: (a: A) => B) {
    return new IO(() => f(self.io()))
}

new IO(() => 0).map((n) => n + 1)