import { T } from './T.js'

/**
 * @tsplus fluent T op
 */
export function op2_<A>(_self: T<A>, x: number): T<number> {
  return { value: x }
}

/**
 * @tsplus pipeable T op
 */
export function op2(x: number) {
  return <A>(_self: T<A>): T<number> => op2_(_self, x)
}