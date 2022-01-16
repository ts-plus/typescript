import { TypeLevel } from "./check"

export const Brand: {
    readonly sym: unique symbol
    readonly validator: <A, S extends string>(_: (_: A) => boolean) => Brand.Validator<A, S>
} = {
    sym: Symbol() as any,
    validator: _ => _ as any
}

export interface Brand<S extends string> {
    [Brand.sym]: {
        [k in S]: true
    }
}

export declare namespace Brand {
    interface Validator<A, S extends string> {
        readonly _tag: "Validator"
        readonly is: (a: A) => a is A & Brand<S>
    }
    type Of<A extends Brand<any>> = TypeLevel.UnionToIntersection<
        { [k in keyof A[typeof Brand["sym"]]]: k extends string ? Brand<k> : never }[keyof A[typeof Brand["sym"]]]
    >
    type Unbranded<A extends Brand<any>> = A extends infer X & Of<A> ? X : never
}
