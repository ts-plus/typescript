import { Effect } from "./prelude.js";
import { Maybe } from "./prelude.js";
import { Nothing } from "./prelude/definition/Maybe.js";

export const isPositive = (n: number) =>
  n > 0 ? Maybe.just("positive") : Maybe.nothing();

export const isPositiveEff = (n: number) =>
  n > 0 ? Effect("positive") : Effect.fail("negative");

export const resultEither = isPositive(0).match(() => "nope", () => "yeah");

Effect.succeedNow("A")

export const prog = Effect.do
  .bind("a", () => Effect(0))
  .bind("b", () => Effect(1))
  .bind("c", () => Effect(2))
  .bind("d", () => Effect(4) + Effect(5))
  .map(({ a, b, c, d: { tuple: [e, f] } }) => `result: ${a + b + c} ${e} ${f}`)
  .flatMap((s) => Effect(console.log(s)));

export const result = prog | Effect.fail("error");

export const zipped = Effect.succeed(0) + Effect.succeed(1)

prog.unsafeRunPromise()

export const xxx = pipe(0, n => n + 1, n => `hello: ${n}`);

const x: Maybe<number> = Maybe.just(0);

const y = x.isJust() ? x.value : undefined;

x.assertJust();

const z = x.value;

const z2 = x.isJust() ? x.zip(Maybe.just("ok")) : 0

declare global {
  /**
   * @tsplus type Array
   */
  export interface Array<T> { }
}

/**
 * @tsplus fluent Array map0
 */
export function arrayFunc<A>(self: Array<A>, f: (a: A) => A): Array<A> {
  return self.map(f);
}

/**
 * @tsplus getter Array getter
 */
export function arrayGetter<A>(self: Array<A>): Array<A> {
  return self;
}

/**
 * @tsplus getter Array head
 */
export function arrayHead<A>(self: Array<A>): A | undefined {
  return self[0]
}

const a = [1, 2, 3].map0((a) => a).getter.map0((a) => a).getter.head

const x2 = Effect(0)

function baseConstraint<A extends Array<unknown>>(...xs: A): unknown[] {
  return xs.map0((a) => a)
}

function id2<A>(a: A): A { return a }

const xxx2 = id2("aaa")

/**
 * @tsplus fluent ets/Effect identity
 * @tsplus fluent Maybe identity
 * @tsplus getter ets/Effect identityGetter
 * @tsplus getter Maybe identityGetter
 * @tsplus static ets/EffectOps identity
 * @tsplus static MaybeOps identity
 */
export function identity<A>(self: A): A {
  return self;
}

Effect.succeed(0).identity()

Maybe.just(0).identity()

Effect.succeed(0).identityGetter

Maybe.just(0).identityGetter

Maybe.identity(0)

Effect.identity(0)

const maybe: Maybe<number> = Maybe.just(0)

if (maybe.isNothing()) {
  const u = maybe
  const x = maybe.assertJust()
}

const xx3: Nothing = {
  _tag: "Nothing"
}

const x4 = xx3.assertJust()

const zzz = 0 as any

const zzz2 = Effect.succeed(() => zzz)

// @ts-expect-error
const zzz3 = Effect.succeed(zzz)
