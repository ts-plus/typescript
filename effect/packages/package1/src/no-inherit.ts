/**
 * @tsplus type no-inherit/A
 */
export interface A<X> {
  readonly _X: X
}

/**
 * @tsplus type no-inherit/B
 * @tsplus no-inherit no-inherit/A
 */
export type B<X> = A<A<X>>

/**
 * @tsplus fluent no-inherit/A fnA
 */
export declare function fnA<X>(_: A<X>): A<X>

/**
 * @tsplus fluent no-inherit/B fnB
 */
export declare function fnB<X>(_: B<X>): B<X>

declare const b: B<string>