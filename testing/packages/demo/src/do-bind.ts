export interface Foo {
    readonly foo: string;
}

export const Foo = Service.Tag<Foo>();

export interface Bar {
    readonly bar: string;
}

export const Bar = Service.Tag<Bar>();

export const res = Do(($) => {
    $(Effect.succeed(0));
    $(Effect.serviceWith(Foo, (_) => _.foo));
    $(Effect.serviceWith(Bar, (_) => _.bar));
    $(Effect.fail("a" as const));
    $(Effect.fail("b" as const));
});

export const res2 = Do(($) => {
    const a = $(Either.right(0));
    const b = $(Either.right(1));
    return `${a} + ${b}`;
});

export const res3 = Do(($) => {
    const a = $(Either.right(0));
    const b = $(Either.right(1));
    return $(Either.right(`${a} + ${b}`));
});

const deferred = Deferred.unsafeMake<never, void>(FiberId.none);

export const res4 = Do(($) => {
    const y = $(Do(($) => {
        $(Deferred.make<never, void>());
        return $(deferred.isDone());
    }));
    return y;
});
