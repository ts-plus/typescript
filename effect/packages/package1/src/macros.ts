/**
 * @tsplus type Macros
 */
export interface Macros {}

declare const macros: Macros

/**
 * @tsplus macro identity
 * @tsplus getter Macros identity
 */
export function identity<A>(a: A): A {
  return a
}

/**
 * @tsplus macro remove
 */
function concrete(u: unknown): asserts u is any {
  //
}

macros.identity

identity(0);

concrete(0);