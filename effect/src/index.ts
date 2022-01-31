import { Effect } from "./prelude.js";
import { Maybe } from "./prelude.js";

export const isPositive = (n: number) =>
  n > 0 ? Maybe.just("positive") : Maybe.nothing();

export const isPositiveEff = (n: number) =>
  n > 0 ? Effect("positive") : Effect.fail("negative");

export const resultEither = isPositive(0).match(() => "nope", () => "yeah");

export const prog = Effect.do
  .bind("a", () => Effect(0))
  .bind("b", () => Effect(1))
  .bind("c", () => Effect(2))
  .bind("d", () => Effect(4) + Effect(5))
  .map(({ a, b, c, d: { tuple: [e, f] } }) => `result: ${a + b + c} ${e} ${f}`)
  .flatMap((s) => Effect(console.log(s)));

export const result = prog | Effect.fail("error");

prog.unsafeRunPromise()

export const xxx = pipe(0, n => n + 1, n => `hello: ${n}`);

const x: Maybe<number> = Maybe.just(0);

const y = x.isJust() ? x.value : undefined;

x.assertJust();

const z = x.value;

declare global {
  /**
   * @tsplus type Array
   */
  export interface Array<T> {}
}

/**
 * @tsplus fluent Array map0
 */
export function arrayFunc <A>(self: Array<A>, f: (a: A) => A): Array<A> {
  return self.map(f);
}

/**
 * @tsplus getter Array getter
 */
export function arrayGetter <A>(self: Array<A>): Array<A> {
  return self;
}

const a = [1, 2, 3].map0((a) => a).getter.map0((a) => a).getter
