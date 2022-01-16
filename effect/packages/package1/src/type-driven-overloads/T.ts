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
 * Comment 1
 * @tsplus static TOps make
 * @tsplus static TOps __call
 */
export function make(value: number): T<number>
/**
 * Comment 2
 */
export function make(value: string): T<string>
export function make<A>(value: A): T<A> {
  return { value }
}