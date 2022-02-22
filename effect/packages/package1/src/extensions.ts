import { LazyArgument } from "./utils/LazyArgument.js";

export interface Base {
    maybe: <A>(a: LazyArgument<A>) => A
}

export class Hello implements Base{
    maybe = <A>(a: LazyArgument<A>) => {
        return a()
    }
}

export const res = new Hello().maybe(0)