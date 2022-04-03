import { Show } from "./show";

export function f<A>(/** @implicit */_show: Show<A>): Show<Maybe<A>> {
    const ok: Show<Maybe<A>> = Derive()
    return ok;
}

export function g<A>(/** @implicit */_show: Show<A>): Show<Maybe<A>> {
    const go = () => {
        const _show = 0;
        _show;
        const ok: Show<Maybe<A>> = Derive()
        return ok;
    }
    return go();
}

/**
 * @implicit
 */
const _showSourceScoped: Show<{ x: number }> = Derive()

_showSourceScoped;

export function h() {
  // uses _showSourceScoped
  const ok: Show<{ x: number }> = Derive()
  return ok;
}

export function i() {
  /**
   * @implicit
   */
  const _showBlockScoped: Show<{ x: number }> = Derive();
  _showBlockScoped;
  const ok: Show<{ x: number }> = Derive();
  return ok;
}