import { LazyArgument } from "./utils/LazyArgument";

export function lazyIn<A extends number>(_: LazyArgument<A>) {
    return _
}

lazyIn(1)

// @ts-expect-error
lazyIn("ok")