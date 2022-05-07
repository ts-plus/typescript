import { Show } from "./show";

function print<A>(a: A, /** @tsplus auto */ show: Show<A>): void {
  console.log(show.show(a))
}

print("Hi")
print({ a: 1, b: "hello", c: new Date() })

// function err(a: string, /** @tsplus auto */ b: number, c: boolean): void {}

/**
 * @tsplus type auto/T
 */
export interface T<A> {
  a: A
}

/**
 * @tsplus implicit
 */
export const implicit: T<string> = {
  a: ""
}

// Non-generic
declare function f(a: string, /** @tsplus auto */ b: T<string>): void

f("1")