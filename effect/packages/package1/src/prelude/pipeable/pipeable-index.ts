/**
 * @tsplus type pipeable-index/X
 */
export interface X {}

// /**
//  * @tsplus index pipeable-index/X
//  */
// export declare function f(self: X, index: number): void

// /**
//  * @tsplus pipeable-index pipeable-index/X
//  */
// export declare function fn(index: number): (self: X) => string

/**
 * @tsplus pipeable-index pipeable-index/X
 */
export declare const fn: (index: number) => (self: X) => string

declare const x: X

const y = x[1]
