/**
 * @tsplus type T
 */
export interface T<A> {
  readonly value: A
}

/**
 * @tsplus type TOps
 */
export interface TOps {}

export const T: TOps = {}

/**
 * @tsplus static TOps make
 */
export function make<A>(value: A): T<A> {
  return { value }
}