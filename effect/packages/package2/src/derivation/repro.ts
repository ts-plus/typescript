// REPRO

import { Applicative, h, HKT } from "./auto";

export interface XF extends X<any, any, any> {}

/**
 * @tsplus type auto/X
 */
export interface X<S1, S2, A> {
  [HKT.F]?: XF;
  [HKT.A]?: () => A;
  [HKT.E]?: () => S2;
  [HKT.R]?: (_: S1) => void;
  [HKT.T]?: X<HKT._R<this>, HKT._E<this>, HKT._A<this>>;
}

export interface XFixedF extends XFixed<any, any> {}

export interface XFixed<S, A> {
  [HKT.F]?: XF
  [HKT.A]?: () => A
  [HKT.E]?: () => S
  [HKT.R]?: (_: S) => void
  [HKT.T]?: X<HKT._R<this>, HKT._E<this>, HKT._A<this>>
}

/**
 * @tsplus implicit
 */
export declare const ApplicativeX: Applicative<XFixedF>;

declare const x1: X<string, string, number>

// @ts-expect-error
function f([a, b]: [number, number]) {
  h.traverse(() => x1)
}

// @ts-expect-error
h.traverse(() => x1)