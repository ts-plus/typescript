/**
 * @tsplus type pipeable-overload/T
 */
export interface T {}

/**
 * @tsplus pipeable pipeable-overload/T f
 */
export const f1 = (x: number) => (self: T): void => {}

/**
 * @tsplus pipeable pipeable-overload/T f
 */
export const f2 = (x: string) => (self: T): void => {}

declare const t: T

t.f("1")

t.f(1)

