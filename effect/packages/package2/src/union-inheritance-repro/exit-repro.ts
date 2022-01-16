import { Equals, equalsSym } from "./Equals"

export class Success<A> implements Equals {
  readonly _tag = "Success"
  constructor(readonly value: A) {}
  [equalsSym](that: unknown): boolean {
    return this === that;
  }
}

export class Failure<E> implements Equals {
  readonly _tag = "Failure"
  constructor(readonly error: E) {}
  [equalsSym](that: unknown): boolean {
    return this === that;
  }
}

/**
 * @tsplus type union-inheritance-repro/Exit
 */
export type Exit<E, A> = Failure<E> | Success<A>

declare const test1: Exit<string, number>
declare const test2: Exit<string, number>

export function test() {
  test1.equals(test2)
  ;(test1 == test2)
}
