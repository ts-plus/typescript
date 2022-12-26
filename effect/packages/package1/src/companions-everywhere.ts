declare global {
  /**
   * @tsplus companion ReadonlyArray
   */
  interface ReadonlyArray<T> {}
  /**
   * @tsplus companion Symbol
   */
  interface Symbol {}
}

/**
 * @tsplus static ReadonlyArray make
 */
export function make<T>(...xs: ReadonlyArray<T>): ReadonlyArray<T> {
  return xs
}

/**
 * @tsplus type companions-everwhere/A
 * @tsplus companion companions-everywhere/AOps
 */
export type A = {}

/**
 * @tsplus static companions-everywhere/AOps get
 */
export const get: A = {}

/**
 * @tsplus static companions-everywhere/AOps __call
 */
export const callA = (): A => ({})

ReadonlyArray.make(1, 2, 3, 4);