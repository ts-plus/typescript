/**
 * @tsplus type type-and-static/A
 */
 export interface A {}

 /**
  * @tsplus type type-and-static/AOps
  */
 export interface AOps {}
 
 export const A: AOps = {}
 
 /**
  * @tsplus type type-and-static/AAspects
  */
 export interface AAspects {}
 
 /**
  * @tsplus static type-and-static/AOps $
  */
 export const AAspects: AAspects = {}
 
 /**
  * @tsplus static type-and-static/AOps staticFn
  * @tsplus static type-and-static/AAspects staticFn
  */
 export function staticFn(x: number): void {}
 
 /**
  * @tsplus static type-and-static/AOps staticConstFn
  * @tsplus static type-and-static/AAspects staticConstFn
  */
 export declare const staticConstFn: (x: number) => void

 A.staticFn(1)
 A.staticConstFn(1)
 
 A.$.staticFn(1)
 A.$.staticConstFn(1)