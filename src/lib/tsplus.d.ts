/// <reference lib="es5" />

declare type PipeableShift<A extends any[]> = A extends [infer X, ...infer Rest] ? Rest : never
declare type PipeableFirst<A extends any[]> = A extends [infer X, ...infer Rest] ? X : never

/**
 * @tsplus macro pipeable
 */
declare function Pipeable<F extends (self: any, ...rest: any) => any>(f: F): (...rest: PipeableShift<Parameters<F>>) => (self: PipeableFirst<Parameters<F>>) => ReturnType<F>