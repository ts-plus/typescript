// collection

/**
 * @tsplus type intersection-inheritance/A
 */
export interface A extends B {
  readonly _A: unique symbol
}

/**
 * @tsplus type intersection-inheritance/B
 */
export interface B {
  readonly _B: unique symbol
}

/**
 * @tsplus type intersection-inheritance/D
 */
export interface D extends B {
  readonly _D: unique symbol
}

/**
 * @tsplus type intersection-inheritance/C
 */
export type C = A & D

/**
 * @tsplus fluent intersection-inheritance/A fn
 */
export declare function fnA(self: A): void

/**
 * @tsplus fluent intersection-inheritance/B fn
 */
export declare function fnB(self: B): void

/**
 * @tsplus fluent intersection-inheritance/C fn
 */
export declare function fnC(self: C): void

/**
 * @tsplus fluent intersection-inheritance/D fn
 */
export declare function fnD(self: D): void

declare const c: C

c.fn()
