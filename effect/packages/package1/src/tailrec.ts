import * as C from "@effect-ts/core/Effect/Cause"
import * as L from "@effect-ts/core/Collections/Immutable/List"
import * as O from '@effect-ts/core/Option'

/**
 * @tsplus tailRec
 */
function fac(x: number, acc = 1): number {
    if (x === 0) {
        return acc;
    }
    return fac (x - 1, x * acc)
}

/**
 * @tsplus tailRec
 */
 function findLoop<A, B>(
    cause: C.Cause<A>,
    f: (cause: C.Cause<A>) => O.Option<B>,
    stack: L.List<C.Cause<A>>
  ): O.Option<B> {
    const r = f(cause)
    switch (r._tag) {
      case "None": {
        switch (cause._tag) {
          case "Both":
          case "Then": {
            return findLoop(cause.left, f, L.prepend_(stack, cause.right))
          }
          case "Traced": {
            return findLoop(cause.cause, f, stack)
          }
          default: {
            if (!L.isEmpty(stack)) {
              return findLoop(L.unsafeFirst(stack)!, f, L.tail(stack))
            }
            return O.none
          }
        }
      }
      case "Some": {
        return O.some(r.value)
      }
    }
  }