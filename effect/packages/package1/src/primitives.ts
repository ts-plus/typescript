declare global {
  /**
   * @tsplus type string
   */
  export interface String {}
  /**
   * @tsplus type number
   */
  export interface Number {}
  /**
   * @tsplus type boolean
   */
  export interface Boolean {}
  /**
   * @tsplus type bigint
   */
  export interface BigInt {}
  /**
   * @tsplus type function
   */
  export interface Function {}
  /**
   * @tsplus type regexp
   */
  export interface RegExp {}
  /**
   * @tsplus type object
   */
  export interface Object {}
}
declare const a: string;
declare const b: number;

/**
 * @tsplus getter string lines
 */
export function lines(self: string): string[] {
  return self.split("\n");
}

const xs = a.lines;

/**
 * @tsplus fluent number days
 */
export function days(self: number, n: number): Date {
  return new Date();
}

(0).days(1);

/**
 * @tsplus fluent function flow
 */
export function flow<A, B, C>(f: (a: A) => B, g: (b: B) => C): (a: A) => C {
  return a => g(f(a));
}

const fn = ((x: number) => x.toString()).flow(s => parseInt(s));

/**
 * @tsplus fluent regexp testTwo
 */
export function testTwo(self: RegExp, that: RegExp): (s: string) => boolean {
  return s => self.test(s) && that.test(s);
}

(/^$/).testTwo(/^$/)


/**
 * @tsplus type FunctionN
 */
export interface FunctionN<A extends readonly any[], B> {
  (...params: A): B
}

/**
 * @tsplus fluent FunctionN flow2
 */
export function flow2<A extends readonly any[], B, C>(self: FunctionN<A, B>, f: (b: B) => C): FunctionN<A, C> {
  return (...params) => f(self(...params))
}

declare const ff: FunctionN<[string, number, boolean], string>

ff.flow2((s) => parseInt(s))

/**
 * @tsplus fluent object mapObject
 */
export function mapObject<A, B>(self: Record<string, A>, f: (a: A) => B): Record<string, B> {
  const r = {} as Record<string, B>
  for (const k in self) {
    r[k] = f(self[k])
  }
  return r
}

({ a: "hello" }).mapObject((s) => parseInt(s))