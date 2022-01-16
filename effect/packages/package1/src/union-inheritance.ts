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

// alias inheritance

/**
 * @tsplus type union/AA
 */
export interface AA {
  readonly _AA: unique symbol;
}

/**
 * @tsplus type union/AB
 */
export interface AB extends AA {
  readonly _AB: unique symbol;
}

/**
 * @tsplus type union/AC
 */
export type AC = AA

export type AD = AC | AB

/**
 * @tsplus fluent union/AA methodAA
 */
export declare function methodAA(self: AA): void
/**
 * @tsplus fluent union/AB methodAB
 */
export declare function methodAB(self: AB): void
/**
 * @tsplus fluent union/AC methodAC
 */
export declare function methodAC(self: AC): void

declare const ac: AD

function aliasTest() {
  ac.methodAA()
  // @ts-expect-error
  ac.methodAB()
  ac.methodAC()
}

// --------------------------------------------

/**
 * @tsplus type union/UA
 */
export interface UA {
  readonly _tag: "UA"
}

/**
 * @tsplus type union/UB
 */
export interface UB {
  readonly _tag: "UB"
}

/**
 * @tsplus type union/UC
 */
export interface UC {
  readonly _tag: "UC"
}

/**
 * @tsplus type union/U
 */
export type U = UA | UB | UC

/**
 * @tsplus fluent union/U u_op
 */
export declare function u_op(u: U): void

declare const u: U

declare const ub: UB

function u_test() {
  if (u._tag === "UA") {
    u.u_op()
  } else {
    u.u_op()
  }
}