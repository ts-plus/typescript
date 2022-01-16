import { T } from './T.js'

/**
 * @tsplus fluent T op
 */
export function op1_<A>(_self: T<A>, x: string): T<string> {
  return { value: x }
}

/**
 * @tsplus pipeable T op
 */
export function op1(x: string) {
  return <A>(_self: T<A>): T<string> => op1_(_self, x)
}