import { T } from './T.js'

/**
 * Comment1
 *
 * @tsplus fluent T op 0.1
 * @tsplus operator T + 0.1
 */
export function op1_<A>(_self: T<A>, x: string): T<string>
export function op1_<A>(_self: T<A>, x: boolean): T<string>
export function op1_<A>(_self: T<A>, x: string | boolean): T<string> {
  return { value: x.toString() }
}

/**
 * @tsplus pipeable T op
 */
export function op1(x: string) {
  return <A>(_self: T<A>): T<string> => op1_(_self, x)
}