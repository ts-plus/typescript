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
