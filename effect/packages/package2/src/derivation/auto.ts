import { Show } from "./show";

function print<A>(a: A, /** @tsplus auto */ show: Show<A>): void {
  console.log(show.show(a))
}

print("Hi")
print({ a: 1, b: "hello", c: new Date() })