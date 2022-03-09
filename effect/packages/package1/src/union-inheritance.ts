/**
 * @tsplus type union/Cons
 */
export class Cons<A> implements Iterable<A> {
  readonly _tag = "Cons";
  constructor(readonly head: A, readonly tail: List<A>) {}
  // @ts-expect-error
  [Symbol.iterator]() {}
}

/**
 * @tsplus type union/Nil
 */
export class Nil<A> implements Iterable<A> {
  readonly _tag = "Nil";
  // @ts-expect-error
  [Symbol.iterator]() {}
}

/**
 * @tsplus type union/List
 */
export type List<A> = Cons<A> | Nil<A>;

/**
 * @tsplus fluent union/List map
 */
export declare function mapList<A, B>(list: List<A>, f: (a: A) => B): List<B>;

declare const x: List<string>;

function transformTest() {
  x.map(s => s);
}

/**
 * @tsplus type union/A
 */
export interface A {
  readonly _A: unique symbol;
}

/**
 * @tsplus type union/B
 */
export interface B {
  readonly _B: unique symbol;
}

/**
 * @tsplus type union/C
 */
export interface C extends A {
  readonly _C: unique symbol;
}

/**
 * @tsplus type union/D
 */
export interface D extends A, B {
  readonly _D: unique symbol;
}

/**
 * @tsplus type union/E
 */
export type E = C | D;

/**
 * @tsplus fluent union/A methodA
 */
export declare function methodA(self: A): void;

/**
 * @tsplus fluent union/B methodB
 */
export declare function methodB(self: B): void;

/**
 * @tsplus fluent union/E methodE
 */
export declare function methodE(self: E): void;

declare const e: E;

function subtypeTest() {
  e.methodE();
  e.methodA();
  // @ts-expect-error
  e.methodB();
}
