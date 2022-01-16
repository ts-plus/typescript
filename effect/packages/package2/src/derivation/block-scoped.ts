import { Show } from "./show";

export interface Info<A> {
  readonly info: (a: A) => string
}

export function f<A>(show: Show<A> & Info<A>): Show<Maybe<A>> {
    const ok: Show<Maybe<A>> = Derive()
    return ok;
}

export function g<A>(show: Show<A>): Show<Maybe<A>> {
    const go = () => {
        const _show = 0;
        _show;
        const ok: Show<Maybe<A>> = Derive()
        return ok;
    }
    return go();
}

interface Target {
  x: number;
}

/**
 * @tsplus implicit local
 */
const _showSourceScoped: Show<{
  x: number;
}> = Derive()

export function h() {
  // uses _showSourceScoped
  const ok: Show<Target> = Derive()
  return ok;
}

export function i() {
  /** @tsplus implicit local */
  const _showBlockScoped: Show<Target> = Derive();
  const ok: Show<Target> = Derive();
  return ok;
}

const id = <A>(a: () => A) => a()

export function j() {
  return id(() => {
    /** @tsplus implicit local */
    const _showBlockScoped: Show<Target> = Derive();
    const ok: Show<Target> = Derive()
    if (Math.random() > 0 && ok) {
      return 0
    }
  })
}