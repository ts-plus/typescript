import { Show } from "./show";

function print<A>(a: A, /** @tsplus auto */ show: Show<A>): void {
  console.log(show.show(a));
}

print("Hi");
print({ a: 1, b: "hello", c: new Date() });

// function err(a: string, /** @tsplus auto */ b: number, c: boolean): void {}

/**
 * @tsplus type auto/T
 */
export interface T<A> {
  a: A;
}

/**
 * @tsplus implicit
 */
export const implicit: T<string> = {
  a: ""
};

/**
 * @tsplus implicit
 */
export const implicit2: T<number> = {
  a: 0
};

// single Non-generic
declare function f(a: string, /** @tsplus auto */ b: T<string>): void;

f("1");

// non-single non-generic
declare function f1(x: number, y: string, /** @tsplus auto */z: T<string>): void
declare function f1(x: number, y: number, /** @tsplus auto */z: T<number>): void

f1(1, "")
f1(1, 1)

export declare namespace HKT {
  const F: unique symbol;
  type F = typeof F;
  const A: unique symbol;
  type A = typeof A;
  const E: unique symbol;
  type E = typeof E;
  const R: unique symbol;
  type R = typeof R;
  const T: unique symbol;
  type T = typeof T;

  type _A<X extends HKT> = X extends { [A]?: () => infer A } ? A : never;
  type _E<X extends HKT> = X extends { [E]?: () => infer E } ? E : never;
  type _R<X extends HKT> = X extends { [R]?: (_: infer R) => void } ? R : never;

  /**
   * @tsplus type fncts.Kind
   */
  type Kind<F extends HKT, R, E, A> = F & {
    [F]?: F;
    [A]?: () => A;
    [E]?: () => E;
    [R]?: (_: R) => void
  } extends { [T]?: infer X }
    ? X
    : {
        [F]?: F;
        [E]?: () => E;
        [A]?: () => A;
        [R]?: (_: R) => void
      };

  export interface Typeclass<F extends HKT> {
    [HKT.F]?: F;
  }
}

export interface HKT {
  [HKT.F]?: HKT;
  [HKT.A]?: () => unknown;
  [HKT.E]?: () => unknown
  [HKT.R]?: (_: never) => void
  [HKT.T]?: unknown;
}

export interface Applicative<F extends HKT> extends HKT.Typeclass<F> {
  zipWith<R, E, A, R1, E1, B, C>(
    fa: HKT.Kind<F, R, E, A>,
    fb: HKT.Kind<F, R1, E1, B>,
    f: (a: A, b: B) => C
  ): HKT.Kind<F, R & R1, E | E1, C>;
}

export interface Traversable<F extends HKT> extends HKT.Typeclass<F> {
  traverse<G extends HKT, R, E, A, R1, E1, B>(
    ta: HKT.Kind<F, R, E, A>,
    f: (a: A) => HKT.Kind<G, R1, E1, B>
  ): HKT.Kind<G, R1, E1, HKT.Kind<F, R, E, B>>;
}

/**
 * @tsplus fluent fncts.Kind traverse
 */
export declare function traverse<_F extends HKT, G extends HKT, R, E, A, R1, E1, B>(
  self: HKT.Kind<_F, R, E, A>,
  f: (a: A) => HKT.Kind<G, R1, E1, B>,
  /** @tsplus auto */ F: Traversable<_F>,
  /** @tsplus auto */ G: Applicative<G>
): HKT.Kind<G, R1, E1, HKT.Kind<_F, R, E, A>>


export interface HF extends H<any> {}

/**
 * @tsplus type auto/H
 * @tsplus type fncts.Kind
 */
export interface H<A> {
  [HKT.F]?: HF;
  [HKT.A]?: () => A;
  [HKT.T]?: H<HKT._A<this>>;
}

export interface GF extends G<any> {}

/**
 * @tsplus type auto/G
 */
export interface G<A> {
  [HKT.F]?: GF;
  [HKT.A]?: () => A;
  [HKT.T]?: G<HKT._A<this>>;
}

/**
 * @tsplus implicit
 */
export declare const TraversableT: Traversable<HF>;

/**
 * @tsplus implicit
 */
export declare const ApplicativeG: Applicative<GF>;

export declare const h: H<string>

export declare function mkG<A>(a: A): G<A>

export const res = h.traverse((s) => mkG(s.length))
