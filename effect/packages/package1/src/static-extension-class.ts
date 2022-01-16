/**
 * @tsplus type static-extension-class/A
 */
export interface A {}

/**
 * @tsplus type static-extension-class/B
 * @tsplus companion static-extension-class/C
 * @tsplus static static-extension-class/A B
 */
export class B {}

/**
 * @tsplus static static-extension-class/C f
 */
export declare function f(): B

declare const a: A

a.B.f();