import { Show } from "./show";

export function f<A>(/** @tsplus implicit local */_show: Show<A>): Show<Maybe<A>> {
    const ok: Show<Maybe<A>> = Derive()
    return ok;
}

export function g<A>(/** @tsplus implicit local */_show: Show<A>): Show<Maybe<A>> {
    const go = () => {
        const _show = 0;
        _show;
        const ok: Show<Maybe<A>> = Derive()
        return ok;
    }
    return go();
}

interface Aliased {
  x: number;
}

/**
 * @tsplus implicit local
 */
const _showSourceScoped: Show<Aliased> = Derive()

export function h() {
  // uses _showSourceScoped
  const ok: Show<{ x: number }> = Derive()
  return ok;
}

export function i() {
  /**
   * @tsplus implicit local
   */
  const _showBlockScoped: Show<{ x: number }> = Derive();
  const ok: Show<{ x: number }> = Derive();
  return ok;
}

const id = <A>(a: () => A) => a()

export function j() {
  return id(() => {
    /** @tsplus implicit local */
    const _showBlockScoped: Show<{ x: number }> = Derive();
    const ok: Show<{ x: number }> = Derive()
    if (Math.random() > 0 && ok) {
      return 0
    }
  })
}