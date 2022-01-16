/**
 * @tsplus type circular/A
 */
export interface A {
  a: ""
}

/**
 * @tsplus getter circular/A test
 */
export function test(a: A) { return {b: 3} }

declare const a: A

const b = a.test


/**
 * @tsplus type circular/B
 */
export type b = typeof b