/**
 * @tsplus type pipeable-operator/T
 */
export interface T {
  readonly __brand: unique symbol
}

/**
 * @tsplus pipeable-operator pipeable-operator/T + 1
 */
export const op1 = (that: T) => (self: T): void => {}

/**
 * @tsplus pipeable-operator pipeable-operator/T +
 */
export const op2 = (that: Date) => (self: T): void => {}

declare const t1: T
declare const t2: T

const test1 = t1 + t2

const test2 = t1 + new Date()



