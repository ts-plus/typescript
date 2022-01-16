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
  const T: unique symbol;
  type T = typeof T;

  type _A<X extends HKT> = X extends { [A]?: () => infer A } ? A : never;

  /**
   * @tsplus type fncts.Kind
   */
  type Kind<F extends HKT, A> = F & {
    [F]?: F;
    [A]?: () => A;
  } extends { [T]?: infer X }
    ? X
    : {
        [F]?: F;
        [A]?: () => A;
      };

  export interface Typeclass<F extends HKT> {
    [HKT.F]?: F;
  }
}

export interface HKT {
  [HKT.F]?: HKT;
  [HKT.A]?: () => unknown;
  [HKT.T]?: unknown;
}

export interface Applicative<F extends HKT> extends HKT.Typeclass<F> {
  zipWith<A, B, C>(
    fa: HKT.Kind<F, A>,
    fb: HKT.Kind<F, B>,
    f: (a: A, b: B) => C
  ): HKT.Kind<F, C>;
}

export interface Traversable<F extends HKT> extends HKT.Typeclass<F> {
  traverse<G extends HKT, A, B>(
    ta: HKT.Kind<F, A>,
    f: (a: A) => HKT.Kind<G, B>
  ): HKT.Kind<G, HKT.Kind<F, A>>;
}

/**
 * @tsplus fluent fncts.Kind traverse
 */
export declare function traverse<_F extends HKT, G extends HKT, A, B>(
  self: HKT.Kind<_F, A>,
  f: (a: A) => HKT.Kind<G, B>,
  /** @tsplus auto */ F: Traversable<_F>,
  /** @tsplus auto */ G: Applicative<G>
): HKT.Kind<G, HKT.Kind<_F, A>>


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

declare const h: H<string>

declare function mkG<A>(a: A): G<A>

export const res = h.traverse((s) => mkG(s.length))


// @ts-expect-error
function z([a, b]: [number, number]) {
  // @ts-expect-error
  h.traverse(() => x1)
}