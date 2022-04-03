import { Show } from "./show";

export function f<A>(_show: Show<A>): Show<Maybe<A>> {
    const ok: Show<Maybe<A>> = Derive()
    return ok;
}

export function g<A>(_show: Show<A>): Show<Maybe<A>> {
    const go = () => {
        const ok: Show<Maybe<A>> = Derive()
        return ok;
    }
    return go();
}