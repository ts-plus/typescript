import { T } from './T.js'

/**
 * @tsplus fluent T op
 */
export function op2 <A>(_self: T<A>, x: number): T<number> {
  return { value: x }
}