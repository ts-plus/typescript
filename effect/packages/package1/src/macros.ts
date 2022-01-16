/**
 * @tsplus macro identity
 */
function identity<A>(a: A): A {
  return a
}

/**
 * @tsplus macro remove
 */
function concrete(u: unknown): asserts u is any {
  //
}

identity(0);

concrete(0);